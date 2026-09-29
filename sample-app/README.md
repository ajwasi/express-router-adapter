# Express Router Adapter Sample App

This is a sample app to demonstrate using ExpressRouterAdapter in an express app to more effectively build RESTful HTTP JSON APIs.

## Getting started

The sample uses the adapter from this repository (`"file:.."`), so build the adapter first, from the repository root:

```
npm install
npm run build
```

Then, in this folder:

```
npm install
npm start
```

The server runs on http://localhost:4000. Try it (the sample treats any `Authorization` header as the user, which is **not** real security):

```
curl -H 'authorization: me' -H 'accept: application/pets+json' http://localhost:4000/pets
```

## Running tests

The integration tests call the running server, so start it (`npm start`) in one terminal and run this in another:

```
npm test
```
