# -*- encoding: utf-8 -*-
import eel
import json
import os
import ovh
import readline
import strings
import time
import utils

ROOTDIR = os.path.dirname(os.path.abspath(__file__))
CONFIG = ROOTDIR + "/config.json"
domain = "tical.fr"


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


def syncheck(redirs_remote: list, config_redir: list):
	'''
		Check if the the whole local (config.json) informations
		are equals to the remote (ovh api) informations
	'''

	if (len(config_redir) != len(redirs_remote)):
		print(" WARNING : local config length DIFFERS from remote !")

	# Loop in the local config
	print("\n Check config...")
	for id, v in config_redir.items():
		try:
			compare(id, config_redir[id], redirs_remote[id])

		except KeyError:
			action = input(f" Redirection {id} [{v['alias']} -> {v['to']}]"
				  		    " unknown in remote config. Create it ? [y/N]")
			if action == "y":
				print(" TODO create a remote entry")
				continue
			else:
				continue

	# Loop in the remote config
	print("\n Check remote...")
	for id, v in redirs_remote.items():
		try:
			compare(id, config_redir[id], redirs_remote[id])
		except KeyError:
			action = input(f" Redirection {id} [{v['alias']} -> {v['to']}]"
				  		 	" unknown in local config. Create it ? [y/N]")
			if action == "y":
				print(" TODO create a local entry")
				continue
			else:
				continue


def compare(id: str, config_data: dict, remote_data: dict) -> int:
	'''
		Compare the given local and remote datas
		
		return values :
			0: data are sync
			1: "alias" differs
			2: "to" differs
			3: both "alias" and "to" differs
	'''
	result = 0

	if config_data['alias'] + domain != remote_data['alias']:
		print(f" Compare {id}: alias differs (local {config_data['alias']}"
			  f" <> remote {remote_data['alias']})")
		result += 1

	if config_data['to'] != remote_data['to']:
		print(f" Compare {id}: to differs (local {config_data['to']}"
			  f" <> remote {remote_data['to']})")
		result += 2
	
	return result


def create_redir(name:str, alias: str, to: str) -> int:
	'''
		Create a new redirection
	'''
	try:
		result = client.post('/email/domain/tical.fr/redirection',
							 _from=alias,
							 localCopy=False,
							 to=to)
		
		# If successfuly created, get ID
		if result:
			id = find_id_by_alias(alias)

			new_redir = {
				"name": name,
				"date": int(time.time()),
				"alias": alias,
				"to": to
			}

			config_redir[id] = new_redir
			write_config(config_redir)
			print(f" Created id {id} : {config_redir[id]['alias']}"
		 		  f" -> {config_redir[id]['to']}")
			return 0
		
	except ovh.APIError as e:
		print(e)
	
	return 1

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


def write_config(config_redir: dict):
	'''
		Write local configuration changes into config.json
	'''
	config['redirection'] = config_redir

	with open(file=CONFIG,
			  mode='w',
			  encoding='utf-8') as json_file:
		json.dump(config, json_file, indent=4)


def input_w_prefill(prompt: str, text: str) -> input:
	def hook():
		readline.insert_text(text)
		readline.redisplay()

	readline.set_pre_input_hook(hook)
	result = input(prompt)
	readline.set_pre_input_hook()
	return result







# Read config file
with open(file=CONFIG,
		  mode='r',
          encoding='utf-8') as json_file:
	config = json.load(json_file)

# Instantiate an OVH Client
client = ovh.Client(
	endpoint = config['token']['endpoint'],
	application_key = config['token']['app_key'],
	application_secret = config['token']['app_secret'],
	consumer_key = config['token']['consumer_key'],
)

config_redir = config['redirection']
config_general = config['general']

# If local config is empty, try to retrieve
# an existing remote redirections
if len(config_redir) < 1:
	config_redir = get_redirs_remote()

# redirs_remote = get_redirs_remote()
# init_check(redirs_remote, config_redir)

print("""======================================
Mail Alias Manager for OVH - MAMO v0.2
Copyright(c) 2024 Antoine Marzin
======================================
 Menu :
  [0] Display redirections
  [1] Create a new redirection
  [2] Edit an existing redirection
  [3] Remove a redirection
  [4] Check/synchronize local configuration with remote (OVH) redirections
  [q] Exit""")

# Main loop
while (True):
	action = input(">> ")


	if (action == "0"):
		for k, v in config_redir.items():
			print(f'{k} -> {v}')
			# TODO tri : date de création > ordre alphab 
			# 			 du domaine > ordre alphab mail


	elif (action == "1"):
		print("Create a new redirection")
		name = input(strings.PROMPT_NAME)

		while True:
			hashq = input(strings.PROMPT_HASH)
			
			if hashq in ("0","1"):
				break
			else:
				print(strings.ERR_HASH)

		if hashq == "0":
			print(" Not implemented yet, using custom alias")
			hashq = "1"
			# TODO alias = randomize something
		
		if hashq == "1":
			while True:
				alias = input(strings.PROMPT_ALIAS)
				if alias and utils.is_valid_email(alias) == True:
					# TODO check si l'alias n'existe pas déjà
					break
				print(strings.err_not_valid_email(alias))

		while True:
			if config_general['default_dest_addr']:
				to = input_w_prefill(strings.PROMPT_DEST,
							  	     config_general['default_dest_addr'])
			else :
				to = input(" Destination address ? ")

			if to and utils.is_valid_email(to) == True:
				break
			print(strings.err_not_valid_email(to))

		create_redir(name, alias, to)


	elif (action == "2"):
		print("Edit an existing redirection")
		id = 0

		while True:
			alias = input(strings.PROMPT_ALIAS)

			if alias == "":
				continue

			if utils.is_valid_email(alias) == True:
				id = find_id_by_alias(alias)
				break
			else:
				print(strings.err_not_valid_email(alias))
				continue

		if id == None:
			print(strings.cant_find_alias(alias))
			continue

		redir = config_redir[id]
		name = input_w_prefill(strings.PROMPT_NAME,
							   redir['name'])
		while True:
			hashq = input(strings.PROMPT_HASH)
			
			if hashq in ("0","1"):
				break
			else:
				print(strings.ERR_HASH)

		if hashq == "0":
			print(" Not implemented yet, using custom alias")
			hashq = "1"
			# TODO alias = randomize something
		
		if hashq == "1":
			while True:
				alias = input_w_prefill(strings.PROMPT_ALIAS, redir['alias'])
				if alias and utils.is_valid_email(alias) == True:
					# TODO check si l'alias n'existe pas déjà
					break
				print(strings.err_not_valid_email(alias))

		while True:
			to = input_w_prefill(strings.PROMPT_DEST, redir['to'])
			if to and utils.is_valid_email(to) == True:
				break
			print(strings.err_not_valid_email(to))

		edit_redir(id, name, alias, to)

	elif (action == "3"):
		print("Remove a redirection")
		while True:
			alias = input(strings.PROMPT_ALIAS)

			if utils.is_valid_email(alias) == True:
				id = find_id_by_alias(alias)
			else:
				print(strings.err_not_valid_email(alias))
				continue

			if id == 0:
				print(strings.cant_find_alias(alias))
				break
			else:
				remove_redir(alias)
				break


	elif (action == "4"):
		print("Check + synchronize local configuration <-> OVH configuration")
		syncheck(redirs_remote=get_redirs_remote(),
	   		 	 config_redir=config_redir)
	
	elif (action == "q"):
		quit()
	else :
		print("Unknown action")