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
		

def get_redirs() -> str:
    redirs = {}

    for k, v in config_redir.items():
        redirs[k] = {
            "name": v["name"],
            "date": v["date"],
            "alias": v["alias"],
            "to": v["to"]
        }
    
    return(json.dumps(redirs, indent=4))


def find_id_by_alias(alias: str):
	'''
		Get a remove redirection ID by its alias
		Return 0 if ID doesn't exists
	'''
	id = None

	# Try to get id from local config
	for k, v in config_redir.items():
		if v['alias'] == alias:
			id = k
			break

	# Try to get id from OVH
	if id == None:
		redirs_remote = get_redirs_remote()

		for k, v in redirs_remote.items():
			if v['alias'] == alias:
				id = k

	return id


def create_redir_remote(alias: str, to: str) -> int:
	'''
		Create a new redirection in remote
		Return 0 if created successfully
		Return 1 otherwise
	'''
	try:
		result = client.post('/email/domain/tical.fr/redirection',
							 _from=alias,
							 localCopy=False,
							 to=to)
		
		# If successfuly created, get ID
		# (API response does not provide it)
		if result:
			return 0
		
	except ovh.APIError as e:
		print(e)
	
	return 1


def create_redir_local(id: int, name:str, alias: str, to: str) -> int:
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
		return 0
	
	except:
		return 1
	
	
def create_redir(name:str, alias: str, to: str) -> int:
	'''
		Create a new redirection (remote + local)
	'''
	res = create_redir_remote(alias=alias,
						   	  to=to)

	if res == 0:
		id = find_id_by_alias(alias)
		res = create_redir_local(id=id,
						   		 name=name,
						   		 alias=alias,
						   		 to=to)
	
	return res


def edit_redir(id: str, name: str, alias: str, to: str) -> int:
	'''
		Edit an existing redirection
	'''
	# Check in config what element is to be modified :
	# - If alias is, the API does NOT allows edition, so we have
	#   to remove and recreate the redirection
	# - If name is, it's only local so just edit config
	# - If "to" address, the API allows direct edition
	for k, v in config_redir.items():
		if k == id:
			if v['alias'] != alias:
				old_alias = v['alias']
				rm = remove_redir(old_alias)
				
				if rm == 0:
					create_redir(name=name,
								 alias=alias,
								 to=to)
					return 0
				else:
					return 1

			if v['name'] != name:
				config_redir[id]['name'] = name
				write_config(config_redir)

			if v['to'] != to:
				try:
					result = client.post("/email/domain/tical.fr/redirection"
						  				 f"/{id}/changeRedirection",
										 to=to)
					if result:
						config_redir[id]['to'] = to
						write_config(config_redir)

				except ovh.APIError as e:
					print(e)
					return 1
			return 0
	return 1


def remove_redir(alias: str) -> int:
	'''
		Create a new redirection
	'''
	id = None

	# Look for ID in local config, else query remote
	for k, v in config_redir.items():
		if v['alias'] == alias:
			id = k
			break
	
	if id == None:
		id = find_id_by_alias(alias)

	# Delete remote, and then local if success
	try:
		result = client.delete(f'/email/domain/{domain}/redirection/{id}')
		if result:
			del config_redir[id]
			write_config(config_redir)
			print(f" {alias} alias removed.")
			return 0

	except ovh.APIError as e:
		print(e)
		return 1
	

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
					id = find_id_by_alias(alias)
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