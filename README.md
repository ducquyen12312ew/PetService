# Pet Service - By QuyenKOL
```bash
Videos and demo images are located in Project-Media.
```
# Installation
## 1. Clone the repository
```bash
git clone git@github.com:ducquyen12312ew/PetService.git
```
Then, move to the directory:
```bash
cd PetService-main
```
## 2. Install requirements
- Download and install `Node.js` from the official website: [Node.js](https://nodejs.org/)
- Open terminal and run:
```bash
node -v
npm -v
npm install
```
- Then install `nodemon`:
```bash
npm install -g nodemon
```
- Download `MongoDB`: [MongoDB Compass](https://www.mongodb.com/try/download/community)
- Then copy the command into terminal to install `mongoose` to interact with MongoDB:
```bash
npm install mongoose
```
# Run the website
From the directory of the repository, run the following:
```bash
Go to the folder containing PetService
cd PetService
nodemon src/index.js
```
Once the above script executes successfully, the local server will be launched. Open the following link in your web browser to view the website:
```bash
localhost:5000
```
To close the server, press `control + C` on the terminal window. 
# Vet mode
You can open the admin site to view the database in a user-friendly GUI. Open the following link:
```bash
localhost:5000/admin-secret
```
Then, log in using admin account:
- Username: `vet`
- Password: `vet`
















