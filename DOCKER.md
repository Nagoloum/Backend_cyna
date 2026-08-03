# Lancer le backend avec Docker

Ce mode d'exécution est une alternative locale ou d'hébergement conteneurisé. Le déploiement de production utilise Render (voir `render.yaml`).

## 1. Préparer le fichier d'environnement

```bash
cp .env.example .env
```

Remplir ensuite les valeurs dans `.env`.

Important : `DATABASE_PASSWORD` doit être le même mot de passe que dans `DATABASE_URL`. Avec Docker Compose, l'API remplace automatiquement `DATABASE_URL` pour pointer vers le conteneur MongoDB.

## 2. Construire l'image

```bash
docker build -t cyna-backend:latest .
```

## 3. Lancer avec MongoDB en local

```bash
docker compose up --build
```

L'API est alors disponible ici :

```text
http://localhost:3000/api
http://localhost:3000/api/docs
```

Si le port `3000` est déjà utilisé, changer `API_PORT` dans `.env`, par exemple :

```env
API_PORT=3001
```

## 4. Exporter et importer l'image (transfert vers une autre machine)

Exporter :

```bash
docker save cyna-backend:latest -o cyna-backend.tar
```

Importer sur la machine cible :

```bash
docker load -i cyna-backend.tar
```

## 5. Lancement manuel sans Compose

Créer un réseau et le volume de données :

```bash
docker network create cyna-network
docker volume create cyna-mongo-data
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
  cyna-backend:latest
```

Vérifier les logs :

```bash
docker logs -f cyna-backend
```
