export const env = {
  apiUrl: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/v1',
  devMode: process.env.NEXT_PUBLIC_DEV_MODE === 'true' || process.env.NODE_ENV === 'development',
};
