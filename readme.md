# Load Stream

[![npm version](https://badge.fury.io/js/load-stream.svg)](https://www.npmjs.com/package/load-stream)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](https://opensource.org/licenses/MIT)

## Description

Load Stream is a versatile package that facilitates the uploading of large files to a server in chunks. The package provides both server-side (`load-stream`) and client-side (`loadstream-client`) components. It utilizes HTTP short polling to break files into chunks and send them to the server, providing multiple listeners for events like progress, completion, and errors.

### Features

- Efficient file uploading with chunking
- HTTP short polling for improved performance
- Multiple event listeners: onprogress, onload, onerror
- Methods for stopping and resuming uploads

## Installation

### Server-Side (load-stream)

Install the package using npm:

```bash
npm install load-stream
```

### Integrate it into your server with Express:

```bash
const loadStream = require('load-stream');
const express = require('express');
const app = express();

/* cb function to provide and modify the fileName and destination(where to save file)
  this cb function expect an argument which contains file information and current uploading directory.
Example:
  file-> {
    fileName:'hello.png',
    fileSize:1242,
    destination:'/' //default destination
  }
*/
const cb = (file) => {
    return {
        fileName: Date.now() + file.fileName,
        destination: '/public/uploads'
    }
}
//creating instance of loadStream
let loader = new loadStream(cb);

//use this loadStream instance as middleware to handle and make http requests
app.use(loader.load());
//on Error 
loader.onerror = (e) => {
    console.log(e);
}
``` 



### Client-Side (CDN)

You can include the client-side library via CDN in your HTML file:

```bash
<script src="/loadStream/loadStream.js"></script>
<script>
  /*
    options = {
     chunksize: 1024 * 1024, // default 1024*1024 (in bytes)
     method: 'http' or 'websocket' // ['websocket','http'] -> fallback from websocket to http
    }
  */
  let options = {
    chunksize: 1024
  }
  let loader = new LoadStream(options); //options argument is optional fallback to default options

  const uploadFile = (file)=>{
      loader.upload(file);
  }

  loader.onprogress = (event) => {
      console.log(event.progress);// progress Example: to use in progress bar
      console.log(event.time); // Expected time remains in uploading file (in seconds)
      console.log(event.speed); // Uploading speed (in bytes/sec) 
  }

  loader.onload = () => {
    console.log("Completed");
  }

  loader.onerror = (event) => {
    console.log(event.error);
  }
  
  const resumeUpload = ()=>{
    loader.resume(); // returns true if resumed else false
  }

  const pauseUpload = ()=>{
    loader.stop();// returns true if paused else false
  }
</script>

```



### Client-Side (loadstream-client)
To include client side script in React.Js/Next.Js etc

```bash
npm install loadstream-client
```

### Integrate it into your client side:
```bash
import loadStream from 'loadstream-client'
```
```bash
/*
  const url='http://localhost:5000'; // url is server's host url 
*/
let loader = new loadStream({ url }) // url is required*

	const uploadFile = async (file) => {
          try {
                       loader.upload(file);

		       loader.onprogress = (event) => {
		            console.log(event.progress);// progress Example: to use in progress bar
		            console.log(event.time); // Expected time remains in uploading file (in seconds)
		            console.log(event.speed);// Uploading speed (in bytes/sec)
		        }
		      
		        loader.onload = () => {
		          console.log("Completed");
		        }
		      
		        loader.onerror = (event) => {
		          console.log(event.error);
		        }
		        
		        const resumeUpload = ()=>{
		          loader.resume(); // returns true if resumed else false
		        }
		      
		        const pauseUpload = ()=>{
		          loader.stop();// returns true if paused else false
		        }

		} catch (error) {
			console.error("Upload error:", error);
		}
```

# Contributing

We welcome contributions! Your contribution means to us.

# License
This project is licensed under the MIT License - see the LICENSE file for details.
