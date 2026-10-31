// 打包前自动递增 patch 版本号（1.1.0 → 1.1.1），写回 package.json。
// 项目非 git 仓库，不涉及 git tag/commit；仅本地修改 version 字段。
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const pkgPath = join(__dirname, '..', 'package.json')
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))

const parts = pkg.version.split('.')
if (parts.length !== 3 || parts.some((n) => Number.isNaN(Number(n)))) {
  throw new Error(`无法解析版本号: ${pkg.version}（期望纯数字三段式，如 1.1.0）`)
}

parts[2] = String(Number(parts[2]) + 1)
pkg.version = parts.join('.')

writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')
console.log(`✔ 版本号已递增: ${pkg.version}`)
