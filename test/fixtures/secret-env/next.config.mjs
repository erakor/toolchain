const config = {
  env: { A: process.env.TRANSIT_TOKEN, B: process.env.SITE_URL, C: { D: process.env['DB_PASSWORD'] } },
  other: process.env.SECRET_OUTSIDE_ENV_BLOCK,
}
export default config
