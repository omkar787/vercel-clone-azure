const { exec } = require("child_process");
const AzureStorageBlob = require("@azure/storage-blob");
const path = require("path");
const fs = require("fs");
var mime = require('mime-types')
const Redis = require("ioredis");



require("dotenv").config()

const publisher = new Redis(process.env.REDIS_URL);

const blobServiceClient = AzureStorageBlob.BlobServiceClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING)
const containerClient = blobServiceClient.getContainerClient(process.env.AZURE_STORAGE_CONTAINER_NAME)


function publishLog(log) {
    publisher.publish(`logs:${process.env.PROJECT_ID}`, JSON.stringify(log));
}

async function init() {
    console.log("Executing script.js");
    publishLog("Build Started....");
    const outputDirPath = path.join(__dirname, "/output");


    // Initiating the build process
    const p = exec(`cd ${outputDirPath} && npm install && npm run build`)

    // Logging the output of the build process
    p.stdout.on("data", (data) => {
        console.log(data);
        publishLog(data.toString());
    });

    // Logging the error of the build process
    p.stderr.on("data", (data) => {
        console.error(data);
        publishLog(`Error: ${data.toString()}`);
    });

    // Logging the completion of the build process
    p.on("close", async (code) => {
        console.log("Build process completed");
        publishLog("Build process completed");

        // Now i'm going to put the objects created (build files) in the "azure storage account"

        //  const distFolderPath = path.join(outputDirPath, "/dist");
        let distFolderPath = path.join(__dirname, "output", "dist");
        const distFolderPathExists = fs.existsSync(distFolderPath);
        console.log("Folder exist:", distFolderPathExists);
        if (!distFolderPathExists) {
            distFolderPath = path.join(__dirname, "output", "build");
        }

        if (fs.existsSync(distFolderPath)) {
            publishLog("Build successful, uploading files to container");
            console.log(distFolderPath);
            const distFolderContents = fs.readdirSync(distFolderPath, { recursive: true });

            for (const fileName of distFolderContents) {
                const filePath = path.join(distFolderPath, fileName)
                try {

                    if (fs.lstatSync(filePath).isDirectory()) continue;

                    const blockBlobClient = containerClient.getBlockBlobClient(`__outputs/${process.env.PROJECT_ID}/${fileName}`)
                    console.log(mime.lookup(filePath));
                    console.log(filePath);
                    console.log("\n");
                    publishLog(`Uploading ${fileName}`);
                    await blockBlobClient.uploadFile(filePath, {
                        blobHTTPHeaders: {
                            blobContentType: mime.lookup(filePath)
                        }
                    });
                    // await blockBlobClient.uploadFile(filePath);
                    console.log(`${fileName} uploaded successfully`)
                    publishLog(`${fileName} uploaded successfully`);

                } catch (error) {
                    console.error(`Error uploading ${fileName}`);
                    publishLog(`Error uploading ${fileName}`);
                    console.log("\n");
                    console.log(error);
                    console.log("\n");
                }
            }


            console.log("\nAll files uploaded to container successfully");
            publishLog("All files uploaded to container successfully");
        } else {
            console.log("Folder does not exist");
            publishLog("Build failed, no files to upload to container");
            console.log("Build failed, no files to upload to container");

        }


    });

}

init();
