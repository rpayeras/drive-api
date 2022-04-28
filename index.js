import fs from 'fs-extra'
import path from 'path'
import mime from 'mime-types'

import Google from './services/Google.js'
import { exit } from 'process'

const args = process.argv.slice(2)
const filePath = args[0]
const remoteFolder = args[1]

if (!filePath || !remoteFolder) exit(console.log('No file or remote folder specified'))

/* Reading the credentials.json file and parsing it. */
const ext = filePath.split('.').pop()
const mimeType = mime.lookup(ext) || 'application/octet-stream'

const googleService = new Google()

await googleService.authorize()

const folders = await googleService.searchFiles(remoteFolder, true)

const metadata = {
  name: path.basename(filePath),
  mimeType,
  parents: [...folders.map(folder => folder.id)]
}

const content = {
  mimeType,
  body: fs.createReadStream(filePath)
}

await googleService.deleteFileByName(metadata.name, false, metadata.parents)

console.log(`Uploading ${JSON.stringify(metadata)}`)

await googleService.uploadFile(content, metadata, folders)
