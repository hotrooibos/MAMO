# MAMO
Mail Aliases Manager for OVH

This work in progress tool goal is to manage e-mail redirections/aliases from OVHcloud, with an additional layer of informations.
This mini project is at a very early stage, so there will be bugs or unexpected behaviours.

Working features :
- List all aliases
- Create and remove an alias
- Edit an alias (any field including the alias address one, which is not available in OVH admin panel)
- Generate an UUID format 
- New alias metadatas : creation/edit date, name/description
- Filter/sort aliases

WIP, or planned/ideas :
- Better sort algorithm (may currently be very slow with high alias list)
- Automatize config file initialization
- Multi domain support
- Secrets and configuration centralization/hosting
- Enhanced batch input : config injection, selection removal...
- Other hosting services support

Under the hood :
- Backend : Uvicorn ASGI + Quart (async Flask) framework
- Front/view : Jinja2 templates, vanilla JS

## Setup
- Clone the repository localy : `git clone https://github.com/hotrooibos/MAMO.git`
- Install dependencies : `pip install -r requirements.txt`
- Create a config.json file based on the given template (copy and rename it)
- Generate your OVH API token (https://api.ovh.com/createToken/index.cgi?GET=/*&PUT=/*&POST=/*&DELETE=/*)
- In the config file, fill the token fields
- Run : `uvicorn mamo:app`