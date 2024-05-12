const express = require('express')
const { generateSlug } = require("random-word-slugs")
const { ContainerInstanceManagementClient } = require("@azure/arm-containerinstance");
const { DefaultAzureCredential } = require("@azure/identity");
const { Server } = require('socket.io')
const Redis = require('ioredis')


require('dotenv').config()

const app = express()
const PORT = 9000
app.use(express.json())


const subscriber = new Redis(process.env.REDIS_URL)
const io = new Server({ cors: '*' })

io.on('connection', (socket) => {
  socket.on('subscribe', (channel) => {
    socket.join(channel)
    socket.emit('message', `Subscribed to ${channel} channel`)


  })
})



io.listen(9001, () => {
  console.log("Socket Server Running on port 9001")
})

async function initRedisSubscriber() {
  console.log("Subscribed to logs....")
  // Subscribing to a specific pattern
  // psubscribe is used to subscribe to a pattern
  subscriber.psubscribe('logs:*')
  subscriber.on('pmessage', (pattern, channel, message) => {
    io.to(channel).emit('message', message)
  })
}

initRedisSubscriber()

app.get('/', (req, res) => {
  res.send("API Server Running..")
})



const resourceGroupName = process.env.RESOURCE_GROUP_NAME;
const defineContainerConfig = (gitURL, projectID, name) => {
  const newContainerConfig = {

    name: name,
    type: 'Microsoft.ContainerInstance/containerGroups',
    location: 'centralindia',
    tags: {},
    containers: [
      {
        name: name,
        image: process.env.BUILD_SERVER_IMAGE,
        environmentVariables: [
          {
            "name": "AZURE_STORAGE_CONNECTION_STRING",
            "value": process.env.AZURE_STORAGE_CONNECTION_STRING
          },
          {
            "name": "AZURE_STORAGE_ACCOUNT_NAME",
            "value": process.env.AZURE_STORAGE_ACCOUNT_NAME
          },
          {
            "name": "AZURE_STORAGE_CONTAINER_NAME",
            "value": process.env.AZURE_STORAGE_CONTAINER_NAME
          },
          {
            "name": "PROJECT_ID",
            "value": projectID
          },
          {
            "name": "GIT_REPO_URL",
            "value": gitURL
          },
          {
            "name": "REDIS_URL",
            "value": process.env.REDIS_URL
          }
        ],
        resources: { requests: { memoryInGB: 1.5, cpu: 1 } }
      }
    ],
    imageRegistryCredentials: [
      {
        server: process.env.AZURE_CONTAINER_REGISTRY_SERVER,
        username: process.env.AZURE_CONTAINER_REGISTRY_USERNAME,
        isDelegatedIdentity: false,
        password: process.env.AZURE_CONTAINER_REGISTRY_PASSWORD
      }
    ],
    restartPolicy: 'Never',

    osType: 'Linux',
    sku: 'Standard',
    initContainers: []
  }

  return newContainerConfig
}


const SUBSCRIPTION_ID = process.env.SUBSCRIPTION_ID
const client = new ContainerInstanceManagementClient(new DefaultAzureCredential(), SUBSCRIPTION_ID)


app.post('/project', async (req, res) => {
  const { gitURL, slug } = req.body
  const projectSlug = slug ? slug : generateSlug()

  const containerConfig = defineContainerConfig(gitURL, projectSlug, projectSlug)

  if (!gitURL) {
    return res.status(400).json({ status: "error", message: "Git URL is required" })
  }

  try {
    const result = await client.containerGroups.beginCreateOrUpdate(resourceGroupName, projectSlug, containerConfig)
    console.log(result);

    return res.json({
      status: "queued", data: {
        projectSlug,
        gitURL,
        url: `http://${projectSlug}.localhost:8000`
      }
    })
  } catch (error) {
    return res.status(500).json({ status: "error", message: error.message })
  }

})


app.listen(PORT, () => console.log(`API Server Running..${PORT}`))