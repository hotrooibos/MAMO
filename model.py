# -*- encoding: utf-8 -*-
import json
import os
import ovh
import strings
import time


def get_redirs_remote() -> dict:
	'''
		Download remote redirections and return it as a dict
	'''
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
		

def get_redirs() -> dict:
    redirs = {}

    for k, v in config_redir.items():
        redirs[k] = {
            "name": v["name"],
            "date": v["date"],
            "alias": v["alias"],
            "to": v["to"]
        }
    
    return(redirs)


def find_id(alias: str, to: str) -> str:
	'''
		Get a remove redirection ID by its alias/to
		Return 0 if ID doesn't exists
	'''
	id = None

	# Try to get id from local config
	for k, v in config_redir.items():
		if v['alias'] == alias and v['to'] == to:
			id = k
			break

	# Try to get id from OVH
	if id == None:
		redirs_remote = get_redirs_remote()

		for k, v in redirs_remote.items():
			if v['alias'] == alias and v['to'] == to:
				id = k

	return id


def create_redir_remote(alias: str, to: str) -> str:
	'''
		Create a new redirection in remote
	'''
	try:
		res = client.post('/email/domain/tical.fr/redirection',
						  _from=alias,
						  localCopy=False,
						  to=to)
		
		return res
				
	except ovh.APIError as e:
		print(e)
		raise
	

def create_redir_local(id: int, name:str, alias: str, to: str):
	'''
		Create a new redirection entry in configuration
	'''
	try:
		new_redir = {
			"name": name,
			"date": int(time.time()),
			"alias": alias,
			"to": to
		}

		config_redir[id] = new_redir
		write_config(config_redir)
	
	except Exception as e:
		print(e)
		raise

	
def create_redir(name:str, alias: str, to: str) -> str:
	'''
		Create a new redirection (remote + local)
	'''
	try:
		res = create_redir_remote(alias=alias,
							   	  to=to)

		id = find_id(alias, to)
		create_redir_local(id=id,
						   name=name,
						   alias=alias,
						   to=to)

		return res
	
	except ovh.APIError as e:
		print(e)
		raise


def edit_redir(id: str, name: str, alias: str, to: str):
	'''
		Edit an existing redirection
	'''
	# Check in config what element is to be modified :
	# - If alias is, the API does NOT allows edition, so we have
	#   to remove and recreate the redirection
	# - If name is, it's only local so just edit config
	# - If "to" address, the API allows direct edition but
	#   changes its id, so we need to get it and update it locally
	for k, v in config_redir.items():

		if k == id:

			if v['alias'] != alias:
				rm = remove_redir(id)
				
				if rm:
					create_redir(name=name,
								 alias=alias,
								 to=to)
				res = 0

			if v['name'] != name:
				config_redir[id]['name'] = name
				res = 0

			if v['to'] != to:
				try:
					res = client.post("/email/domain/tical.fr/redirection"
						  			  f"/{id}/changeRedirection",
									  to=to)
					
					# Update the id
					new_id = find_id(alias, to)
					config_redir[new_id] = config_redir[id]
					config_redir[new_id]['to'] = to
					del config_redir[id]

					res = 0
					break

				except ovh.APIError as e:
					print(e)
					raise
			
	if res:
		write_config(config_redir)
			

def remove_redir(id: int) -> bool:
	'''
		Remove a redirection (remote + local)
	'''
	# Delete remote, and then local if success
	try:
		res = client.delete(f'/email/domain/{domain}/redirection/{id}')
		del config_redir[id]
		write_config(config_redir)
		
		return res
		
	except ovh.APIError as e:
		print(e)
		raise
	

def syncheck(redirs_remote: list, config_redir: list, dry: bool = False):
	'''
		Check both local config and remote redirs,
		and sync them.
		Set dry = True for a dry run (check without creating any entry)
	'''

	if (len(config_redir) != len(redirs_remote)):
		print(" WARNING : local config length DIFFERS from remote !")

	# Loop in the local config
	for id, v in config_redir.items():
		try:
			compare(id, config_redir[id], redirs_remote[id])

		except KeyError:
			alias = config_redir[id]['alias']
			to = config_redir[id]['to']
			if not dry:
				res = create_redir_remote(alias=alias,
										  to=to)
			# Update the ID
				if res == 0:
					id = find_id(alias, to)
					config_redir[id]['alias'] = id

			if dry:
				print(f"Dry creating remote (alias {alias}, to {to}).")

	# Loop in the remote config
	for id, v in redirs_remote.items():
		try:
			compare(id, config_redir[id], redirs_remote[id])

		except KeyError:
			name = strings.SYNCED_ENTRY_NAME
			alias = redirs_remote[id]['alias']
			to = redirs_remote[id]['to']
			if not dry:
				create_redir_local(id=id,
								   name=name,
								   alias=alias,
								   to=to)
			
			if dry:
				print(f"Dry creating local (id {id}, name {name}, alias {alias}, to {to}).")


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

	with open(file=CONFIG,
			  mode='w',
			  encoding='utf-8') as json_file:
		json.dump(config, json_file, indent=4)



ROOTDIR = os.path.dirname(os.path.abspath(__file__))
CONFIG = ROOTDIR + "/config.json"

# Read config file
with open(file=CONFIG,
		  mode='r',
          encoding='utf-8') as json_file:
	config = json.load(json_file)

config_redir = config['redirection']
config_general = config['general']

domain = config_general['domain']

# Instantiate an OVH Client
client = ovh.Client(
	endpoint = config['token']['endpoint'],
	application_key = config['token']['app_key'],
	application_secret = config['token']['app_secret'],
	consumer_key = config['token']['consumer_key'],
)