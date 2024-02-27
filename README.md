# MAMO
Mail Aliases Manager for OVH

This work in progress tool goal is to manage e-mail redirections/aliases from OVHcloud, with an additional layer of informations.
This mini project is at a very early stage, so there will be bugs or unexpected behaviours.

Working features :
- List all aliases
- Create an alias
- Two alias format : random uuid, or manually typed
- New alias metadatas : creation/edit date, name/description
- Edit a redirection, including alias
- Remove an alias

WIP :
- Web UI (porting to Quart + Uvicorn)

Planned/ideas :
- Automatize config file initialization
- Multi domain support
- Filter/sort
- Secrets and configuration centralization/hosting
- Others hosting services support

## Setup
- Clone the repository localy : `git clone https://github.com/hotrooibos/MAMO.git`
- Install dependencies : `pip install -r requirements.txt`
- Create a config.json file based on the given template (copy and rename it)
- Generate your OVH API token (https://api.ovh.com/createToken/index.cgi?GET=/*&PUT=/*&POST=/*&DELETE=/*)
- In the config file, fill the token fields
- Run : `uvicorn mamo:app`