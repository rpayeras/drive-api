import fs from 'fs-extra'
import path from 'path'
import mime from 'mime-types'

import Google from './services/Google.js'
import { exit } from 'process'

const args = process.argv.slice(2)
const filePaths = args.slice(0, args.length - 1)
const remoteFolder = args[args.length - 1]

const googleService = new Google()
await googleService.authorize()

filePaths.forEach(async (filePath, index) => {
  if (!filePath || !remoteFolder) exit(console.log('No file or remote folder specified'))

  /* Reading the credentials.json file and parsing it. */
  const ext = filePath.split('.').pop()
  const mimeType = mime.lookup(ext) || 'application/octet-stream'

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

  console.log(`Uploading ${JSON.stringify(metadata)}`)

  if (filePaths.length > 1) {
    await googleService.deleteFileByName(metadata.name, false, metadata.parents)

    if (index >= filePaths.length - 1) {
      await googleService.uploadFile(content, metadata, folders)
    }
  } else {
    await googleService.deleteFileByName(metadata.name, false, metadata.parents)
    await googleService.uploadFile(content, metadata, folders)
  }
})
