FROM ubuntu:latest

#Install Nodejs and npm
RUN apt-get update && apt-get install -y curl
RUN curl -sL https://deb.nodesource.com/setup_lts.x | bash -
RUN apt-get install -y nodejs


# Create app directory
WORKDIR /app


# Copy package.json and package-lock.json
COPY package*.json ./


# Install app dependencies
RUN npm install
RUN npm install -g typescript


# Copy app source code
COPY . .

# Expose port for the app
EXPOSE 3000

# Start the app
CMD ["npm", "start"]