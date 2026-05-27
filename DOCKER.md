# Lancer le backend avec Docker

## 1. Preparer le fichier d'environnement

```bash
cp .env.example .env
```

Remplir ensuite les valeurs dans `.env`.

Important : `DATABASE_PASSWORD` doit etre le meme mot de passe que dans `DATABASE_URL`.
Avec Docker Compose, l'API remplace automatiquement `DATABASE_URL` pour pointer vers le conteneur MongoDB.

## 2. Construire l'image

```bash
docker build -t cyna-backend:latest .
```

## 3. Tester avec MongoDB en local

```bash
docker compose up --build
```

L'API sera disponible ici :

```text
http://localhost:3000/api
http://localhost:3000/api/docs
```

Si le port `3000` est deja utilise, changer `API_PORT` dans `.env`, par exemple :

```env
API_PORT=3001
```

## 4. Exporter l'image pour le professeur

```bash
docker save cyna-backend:latest -o cyna-backend.tar
```

Envoyer le fichier `cyna-backend.tar` au professeur.

## 5. Commandes pour le professeur

Importer l'image :

```bash
docker load -i cyna-backend.tar
```

Creer un reseau et les volumes :

```bash
docker network create cyna-network
docker volume create cyna-mongo-data
docker volume create cyna-storage
```

Lancer MongoDB :

```bash
docker run -d \
  --name cyna-mongo \
  --network cyna-network \
  -e MONGO_INITDB_ROOT_USERNAME=root \
  -e MONGO_INITDB_ROOT_PASSWORD=change_me \
  -p 27018:27017 \
  -v cyna-mongo-data:/data/db \
  mongo:latest
```

Lancer le backend :

```bash
docker run -d \
  --name cyna-backend \
  --network cyna-network \
  --env-file .env \
  -e DATABASE_URL='mongodb://root:change_me@cyna-mongo:27017/cyna?authSource=admin' \
  -p 3000:3000 \
  -v cyna-storage:/app/storage \
  cyna-backend:latest
```

Verifier les logs :

```bash
docker logs -f cyna-backend
```
