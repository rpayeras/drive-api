import fs from 'fs-extra'
import * as readline from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'

import { google } from 'googleapis'

export default class Google {
  // If modifying these scopes, delete token.json.
  SCOPES = ['https://www.googleapis.com/auth/drive']

  // The file token.json stores the user's access and refresh tokens, and is
  // created automatically when the authorization flow completes for the first
  // time.
  TOKEN_PATH = 'token.json'
  CREDENTIALS_PATH = 'credentials.json'
  oAuthHandler = null
  clientHandler = null

  /**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 * @param {Object} credentials The authorization client credentials.
 */
  async authorize () {
    const credentials = await fs.readFile(this.CREDENTIALS_PATH)
    const { client_secret: clientSecret, client_id: clientId, redirect_uris: redirectUris } = JSON.parse(credentials)

    this.oAuthHandler = new google.auth.OAuth2(clientId, clientSecret, redirectUris[0])

    let token = null

    try {
      token = await fs.readFile(this.TOKEN_PATH)
      token = JSON.parse(token)
    } catch (err) {
      token = await this.getAccessToken()
      await fs.writeFile('token.json', JSON.stringify(token))
    }

    console.log('[Google] Token:', token)

    if (!token) throw new Error('Token not found')

    this.oAuthHandler.setCredentials(token)
    this.clientHandler = google.drive({ version: 'v3', auth: this.oAuthHandler })
    console.log('[Google] Authorized')
  }

  /**
   * Get and store new token after prompting for user authorization, and then
   * execute the given callback with the authorized OAuth2 client.
   * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
   * @param {getEventsCallback} callback The callback for the authorized client.
   */
  getAccessToken () {
    return new Promise((resolve, reject) => {
      const authUrl = this.oAuthHandler.generateAuthUrl({
        access_type: 'offline',
        scope: this.SCOPES
      })

      const rl = readline.createInterface({ input, output })

      console.log('[Google] Authorize this app by visiting this url:', authUrl)

      rl.question('Enter the code from that page here: ').then(code => {
        rl.close()

        this.oAuthHandler.getToken(code, (err, token) => {
          if (err) {
            reject(new Error(err))
          }

          resolve(token)
        })
      })
        .catch(err => reject(new Error(err)))
    })
  }

  /**
   * Lists the names and IDs of up to 10 files.
   * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
   */
  listFiles () {
    this.clientHandler.files.list({
      pageSize: 10,
      fields: 'nextPageToken, files(id, name)'
    }, (err, res) => {
      if (err) return console.log('The API returned an error: ' + err)

      const files = res.data.files

      if (files.length) {
        console.log('Files:')

        files.forEach((file) => {
          console.log(`${file.name} (${file.id})`)
        })
      } else {
        console.log('No files found.')
      }
    })
  }

  uploadFile (media, resource, folders = []) {
    this.clientHandler.files.create({
      resource,
      media,
      fields: 'id'
    }, function (err, file) {
      if (err) {
        // Handle error
        console.error(err)
      } else {
        console.log('[Google] File uploaded, Id:', file.data.id)
      }
    })
  }

  searchFiles (name, isFolder = false, folders = []) {
    return new Promise((resolve, reject) => {
      const fileType = isFolder ? '=' : '!='

      const params = {
        q: 'mimeType' + fileType + "'application/vnd.google-apps.folder'",
        fields: 'files(id, name)',
        spaces: 'drive',
        parents: folders
      }

      this.clientHandler.files.list(params, function (err, res) {
        if (err) return reject(err)

        const files = res.data.files.filter(file => file.name === name)
        console.log('[Google] Found folders:', files)

        resolve(files)
      })
    })
  }

  deleteFileByName (name) {
    return new Promise((resolve, reject) => {
      this.searchFiles(name).then((files) => {
        if (files.length === 0) reject(new Error('File to delete not found'))

        Promise.all(files.map(file => {
          return new Promise((resolve, reject) => {
            this.clientHandler.files.delete({
              fileId: file.id
            }, function (err, res) {
              if (err) reject(err)

              console.log('[Google] File deleted:', res)
              resolve()
            })
          })
        }))
          .then(() => resolve())
          .catch(err => reject(err))
      })
    })
  }
}
