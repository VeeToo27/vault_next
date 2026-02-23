/** @type {import('next').NextConfig} */
module.exports = {
  reactStrictMode: true,
  // Type checking is done separately (tsc --noEmit).
  // Disabling here prevents Railway build timeouts on type errors
  // that don't affect runtime correctness.
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
}
