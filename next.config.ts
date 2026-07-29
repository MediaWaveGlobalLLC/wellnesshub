import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Hay otro package-lock.json más arriba en el árbol del usuario; sin esto Next
  // infiere mal la raíz del workspace.
  turbopack: { root: path.resolve(import.meta.dirname) },
};

export default nextConfig;
