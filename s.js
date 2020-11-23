const axios = require('axios')

axios
  .post('https://copbot-e0c62.firebaseio.com/', {
    todo: 'Buy the milk'
  })
  .then(res => {
    console.log(`statusCode: ${res.statusCode}`)
    console.log(res)
  })
  .catch(error => {
    console.error(error)
  })

  /*'{
  "alanisawesome": {
    "name": "Alan Turing",
    "birthday": "June 23, 1912"
  }
}' 'https://docs-examples.firebaseio.com/rest/saving-data/fireblog/users.json'*/