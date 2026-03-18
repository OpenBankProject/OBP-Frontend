# Docker
## Building and running
It is recommended to use `docker compose` to run and build the portal.

If you don't have the plugin already, [install it](https://docs.docker.com/compose/install/linux/)

Then build the containers with `docker compose build`

Run the containers with `docker compose up`

### Changing the docker config
If you need to make a change to the docker configuration i.e. static environment variables or some other config then run `docker compose down` to get rid of the old containers and images, make the changes, then `docker compose up` again

### Changing code
If you make changes to the source code, you'll have to rebuild.

`docker compose down`

*make the changes

```bash
docker compose build
docker compose up
```

## Handling Environment Variables in Docker
SvelteKit provides four different ways to import environment variables. Be they run time or build time. See a comprehensive guide [here](https://khromov.se/dockerizing-your-sveltekit-applications-a-practical-guide/).
