# NX Tutor

## Create controller example: 
  
``npx nx generate @nx/nest:controller [path]``

``npx nx generate @nx/nest:controller src/app/auth/auth.controller``

### sample for service:
``npx nx generate @nx/nest:service [path]``

``npx nx generate @nx/nest:service src/app/auth/auth.service``

## For add new library:

``npx nx g @nx/nest:lib libs/infra/logger``

### or

``npx nx g @nx/nest:js libs/shared/logger``

## For start:
``npx nx serve api``


NX monorepo structure
All apps and libraries live in a single NX workspace. NX's affected graph ensures only changed projects are built/tested in CI.

