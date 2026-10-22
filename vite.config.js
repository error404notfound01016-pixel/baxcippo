import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import photosAdmin from './vite-plugin-photos-admin'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), photosAdmin()], 
})
