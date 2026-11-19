const config = {
  env: { A: process.env.TRANSIT_TOKEN, B: process.env.SITE_URL, C: { D: process.env['DB_PASSWORD'] },
    E: (() => { const { DB_PASSWORD: pw, SITE_URL: url } = process.env; return [pw, url] })() },
  other: process.env.SECRET_OUTSIDE_ENV_BLOCK,
}
export default config
