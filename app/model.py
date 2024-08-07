# -*- encoding: utf-8 -*-
import json
import os
import ovh
import random
import re
import time


def get_redirs_remote(domain: str) -> dict:
	'''
		Download remote redirections and return it as a dict
	'''
	if domain not in domains:
		raise

	try:
		redir_remote_ids = client.get(f'/email/domain/{domain}/redirection')
		redirs_remote = {}

		for id in redir_remote_ids:
			r = client.get(f'/email/domain/{domain}/redirection/{id}')
			
			# Dict format standardized for local use (empty name/date)
			redirs_remote[r["id"]] = {
				"name": "",
				"date": "",
				"alias": r["from"],
				"to": r["to"]
			}

		return redirs_remote
	
	except ovh.APIError as e:
		print(e)
		raise


def get_redir(id: int) -> dict:
	'''
		Get redirection from given id
		
		Returns a full redirection dict
	'''
	for k, v in config_redir.items():
		if (k == id):
			r = {
				"id": k,
				"name": v["name"],
				"date": v["date"],
				"alias": v["alias"],
				"to": v["to"]
			}

			return(r)


def get_redirs(domain: str = 'all') -> dict:
	'''
		Get redirections dict for a given domain,
		or for all domains (no filter) by default
	'''
	redirs = {}

	for k, v in config_redir.items():
		if (domain != 'all' and \
	  		domain not in v["alias"]):
			continue

		redirs[k] = {
			"name": v["name"],
			"date": v["date"],
			"alias": v["alias"],
			"to": v["to"]
		}

	return(redirs)


async def create_redir_remote(alias: str, to: str) -> str:
	'''
		Create a new redirection in remote
	'''
	domain = alias.split('@')[1]

	if domain not in domains:
		raise

	try:
		res = client.post(f'/email/domain/{domain}/redirection',
						  _from=alias,
						  localCopy=False,
						  to=to)
		
		return res
				
	except ovh.APIError as e:
		print(f"create_redir_remote: {e}")
	

def create_redir_local(id: int, name:str, date:int, alias: str, to: str):
	'''
		Create a new redirection entry in configuration
	'''
	try:
		# If alias already exists, just update the entry's key
		for k, v in config_redir.items():
			if v['alias'] == alias and v['to'] == to:
				config_redir[id] = config_redir.pop(k)
				write_config(config_redir)
				return

		# Create new entry
		new_redir = {
			"name": name,
			"date": date,
			"alias": alias,
			"to": to
		}

		config_redir[id] = new_redir
		write_config(config_redir)
	
	except Exception as e:
		raise

	
async def create_redir(name:str, alias: str, to: str) -> dict:
	'''
		Create a new redirection (remote + local)
		Returns the redirection id if successful

		Returns a dict of created redirection :

		{
			"id": id,
			"name": name,
			"date": date,
			"alias": alias,
			"to": to
		}
	'''
	domain = alias.split('@')[1]

	if domain not in domains:
		raise

	try:
		await create_redir_remote(alias=alias,
								  to=to)
		
		# Get ID from OVH
		# TODO refactoriser cette fonction (create_redir) pour prendre en compte un dico d'alias
		# à créer, et ainsi ne faire la requête qui suit qu'une seule fois
		redirs_remote = get_redirs_remote(domain)

		for k, v in redirs_remote.items():
			if v['alias'] == alias and v['to'] == to:
				id = k
				break

		date = int(time.time())

		create_redir_local(id, name, date, alias, to)

		r = {
			"id": id,
			"name": name,
			"date": date,
			"alias": alias,
			"to": to
		}

		return r
	
	except ovh.APIError as e:
		raise


def edit_redir(id: str, name: str, alias: str, to: str):
	'''
		Edit an existing redirection
	'''
	# Check in config what element is to be modified :
	# - If "alias" is, the API does NOT allow edition, so we have
	#   to remove and recreate the redirection
	#
	# - If "to", the API allows direct edition but changes its id.
	#   Worst, in case the alias is edited right after being
	# 	created, the API duplicates it while throwing the "This element
	#   "is already being processed" error.
	# 	So the safe way is to remove/recreate just like the "alias" case
	#
	# - If name is, it's only local so just edit config
	for k, v in config_redir.items():

		if k == id:

			if v['alias'] != alias or v['to'] != to:
				try:
					rm = remove_redir(id)

					if rm:
						create_redir(name, alias, to)
					res = 0
				
				except ovh.APIError as e:
					print(e)
					raise
				break
				
			if v['name'] != name:
				config_redir[id]['name'] = name
				res = 0
				break
	
	# If everything went well, write changes in config json
	if res:
		write_config(config_redir)
			

def remove_redir(id: int, alias: str, to: str) -> dict:
	'''
		Remove a redirection (remote + local)
	'''
	domain = alias.split('@')[1]

	if domain not in domains:
		raise

	# Delete remote
	try:
		res = client.delete(f'/email/domain/{domain}/redirection/{id}')
	
	# If id (redirection not found), do not raise
	# an error and proceed with local entry deletion
	except ovh.ResourceNotFoundError as e:
		print(e)
		res = e

	except ovh.APIError:
		raise
	
	# Local entry deletion
	del config_redir[id]
	write_config(config_redir)

	return res


def syncheck(redirs_remote: list, config_redir: list) -> tuple:
	'''
		Check both local config and remote redirs,
		and return two lists :

			- list of local entries unknown from remote
			- list of remote entries unknown from local
	'''
	list_local = []
	list_remote = []

	if (len(config_redir) != len(redirs_remote)):
		print(" MODEL.SYNCHECK: local config length differs from remote")

	# Loop in the local config and append
	# to list_local redirections unknown from remote
	for id in config_redir:
		try:
			compare(id, config_redir[id], redirs_remote[id])

		except KeyError:
			name = config_redir[id]['name']
			alias = config_redir[id]['alias']
			to = config_redir[id]['to']
			list_local.append((id, name, alias, to))

	# Loop in the remote config and append
	# to list_remote redirections unknown from local
	for id in redirs_remote:
		try:
			compare(id, config_redir[id], redirs_remote[id])

		except KeyError:
			alias = redirs_remote[id]['alias']
			to = redirs_remote[id]['to']
			list_remote.append((id, alias, to))
	
	# Return a tuple containing the count of remote redirections,
	# and two tuples containing tuples of missing redirs
	return len(redirs_remote), list_local, list_remote


def compare(id: str, config_data: dict, remote_data: dict) -> int:
	'''
		Compare the given local and remote datas
		
		Return values :
			0: data are sync
			1: "alias" differs
			2: "to" differs
			3: both "alias" and "to" differs
	'''
	res = 0

	if config_data['alias'] != remote_data['alias']:
		# print(f" Compare {id}: alias differs (local {config_data['alias']}"
		# 	  f" <> remote {remote_data['alias']})")
		res += 1

	if config_data['to'] != remote_data['to']:
		# print(f" Compare {id}: to differs (local {config_data['to']}"
		# 	  f" <> remote {remote_data['to']})")
		res += 2
	
	return res


def write_config(config_redir: dict):
	'''
		Write local configuration changes into config.json
	'''
	config['redirection'] = config_redir

	with open(file=ROOTDIR + alias_file,
			  mode='w',
			  encoding='utf-8') as json_file:
		json.dump(config, json_file, indent=4)


def generate_name() -> str:
	with open(file=ROOTDIR + "static/adjectives.json",
			mode='r',
			encoding='utf-8') as json_file:
		adjectives = json.load(json_file)

	with open(file=ROOTDIR + "static/nouns.json",
			mode='r',
			encoding='utf-8') as json_file:
		nouns = json.load(json_file)

	return f"{random.choice(adjectives)}-{random.choice(nouns)}"


ROOTDIR = os.path.dirname(os.path.abspath(__file__)) + "/../"

# Read config
with open(file=ROOTDIR + "config.json",
		  mode='r',
          encoding='utf-8') as json_file:
	config = json.load(json_file)

config_general = config['general']
default_dest_addr = config_general['default_dest_addr']
domains = config_general['domains']

# Read aliases
alias_file = config['general']['alias_file']
with open(file=ROOTDIR + alias_file,
		  mode='r',
		  encoding='utf-8') as json_file:
	aliases = json.load(json_file)

config_redir = aliases['redirection']

# Instantiate an OVH Client
client = ovh.Client(
	endpoint = config['token']['endpoint'],
	application_key = config['token']['app_key'],
	application_secret = config['token']['app_secret'],
	consumer_key = config['token']['consumer_key'],
)