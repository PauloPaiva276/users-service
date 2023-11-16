const vault = require('node-vault')({
  endpoint: `http://${process.env.VAULT_HOST}:${process.env.VAULT_PORT}`,
  token: process.env.VAULT_TOKEN
})

async function getJWTSecret () {
  try {
    const result = await vault.read('kv/data/keys')
    return result.data.data.jwt_secret
  } catch (error) {
    console.error('Error fetching secret from Vault:', error.message)
    throw new Error('Error retrieving JWT Secret from Vault')
  }
}

async function getSuperKey () {
  try {
    const result = await vault.read('kv/data/keys')
    return result.data.data.super_key
  } catch (error) {
    console.error('Error fetching secret from Vault:', error.message)
    throw new Error('Error retrieving Super Key from Vault')
  }
}

async function getIV () {
  try {
    const result = await vault.read('kv/data/keys')
    return result.data.data.iv
  } catch (error) {
    console.error('Error fetching secret from Vault:', error.message)
    throw new Error('Error retrieving IV from Vault')
  }
}

module.exports = {
  getJWTSecret,
  getSuperKey,
  getIV
}
