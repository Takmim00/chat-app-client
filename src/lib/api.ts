const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

let isRefreshing = false;
let refreshPromise: Promise<string | null> | null = null;

async function refreshToken(): Promise<string | null> {
  try {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.token || data.accessToken) {
      const newToken = data.token || data.accessToken;
      localStorage.setItem('aurora_token', newToken);
      return newToken;
    }
    return null;
  } catch {
    return null;
  }
}

export async function fetchApi(endpoint: string, options: RequestInit = {}) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('aurora_token') : null;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let res = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  // Auto token refresh on 401 (skip for login/otp/refresh endpoints)
  const isAuthAuthEndpoint = ['/auth/request-otp', '/auth/verify-otp', '/auth/refresh'].some((ep) => endpoint.includes(ep));
  if (res.status === 401 && token && !isAuthAuthEndpoint) {
    let newToken: string | null = null;

    if (!isRefreshing) {
      isRefreshing = true;
      refreshPromise = refreshToken().finally(() => {
        isRefreshing = false;
        refreshPromise = null;
      });
    }

    newToken = await (refreshPromise || refreshToken());

    if (newToken) {
      headers['Authorization'] = `Bearer ${newToken}`;
      res = await fetch(`${API_URL}${endpoint}`, {
        ...options,
        headers,
      });
    } else {
      // Token refresh failed - clear and redirect to login
      localStorage.removeItem('aurora_token');
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('auth:logout'));
      }
    }
  }

  const contentType = res.headers.get('content-type');
  let data: any = {};
  if (contentType && contentType.includes('application/json')) {
    data = await res.json();
  } else {
    const text = await res.text();
    if (!res.ok) {
      throw new Error(`Server error (${res.status}): ${text.substring(0, 100)}`);
    }
  }

  if (!res.ok) {
    throw new Error(data.message || 'An API error occurred');
  }

  return data;
}

export async function uploadToCloudinary(file: File): Promise<{ url: string; size: number; name: string; type: string }> {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || 'aurora_chat_preset';

  // If cloud name is set, upload directly to Cloudinary
  if (cloudName) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', uploadPreset);

    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, {
      method: 'POST',
      body: formData,
    });

    if (res.ok) {
      const data = await res.json();
      return {
        url: data.secure_url,
        size: file.size,
        name: file.name,
        type: file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : file.type.startsWith('audio/') ? 'audio' : 'document',
      };
    }
  }

  // Fallback: local Data URL reader for local testing without Cloudinary preset
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve({
        url: reader.result as string,
        size: file.size,
        name: file.name,
        type: file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : file.type.startsWith('audio/') ? 'audio' : 'document',
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
