# -*- encoding: utf-8 -*-
import json
import os
import ovh
import re
import readline
import time

ROOTDIR = os.path.dirname(os.path.abspath(__file__))
CONFIG = ROOTDIR + "/config.json"
domain = "tical.fr"


def get_redirs_remote() -> dict:
	'''
		Download remote redirections and return it as a dict
	'''
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


def get_remote_id_by_alias(alias: str) -> int:
	'''
		Get a remove redirection ID by its alias
	'''
	redirs_remote = get_redirs_remote()

	for id, v in redirs_remote.items():
		if v['alias'] == alias:
			return int(id)


def syncheck(redirs_remote: list, redirs_config: list):
	'''
		Check if the the whole local (config.json) informations
		are equals to the remote (ovh api) informations
	'''

	if (len(redirs_config) != len(redirs_remote)):
		print(" WARNING : local config length DIFFERS from remote !")

	# Loop in the local config
	print("\n Check config...")
	for id, v in redirs_config.items():
		try:
			compare(id, redirs_config[id], redirs_remote[id])

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
			compare(id, redirs_config[id], redirs_remote[id])
		except KeyError:
			action = input(f" Redirection {id} [{v['alias']} -> {v['to']}]"
				  		 	" unknown in local config. Create it ? [y/N]")
			if action == "y":
				print(" TODO create a local entry")
				continue
			else:
				continue


def compare(id: int, config_data: dict, remote_data: dict) -> int:
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


def create_redir(name:str, alias: str, to: str):
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
			id = get_remote_id_by_alias(alias)

			new_redir = {
				"name": name,
				"date": int(time.time()),
				"alias": alias,
				"to": to
			}

			redirs_config[id] = new_redir
			write_config(redirs_config)
			print(f" Created id {id} : {redirs_config[id]['alias']}"
		 		  f" -> {redirs_config[id]['to']}")

	except ovh.APIError as e:
		print(e)


def edit_redir(id: int, name: str, alias: str, to: str):
	'''
		Edit an existing redirection
	'''
	# Check in config what element is to be modified :
	# - If alias is, the API does NOT allows edition, so we have
	#   to remove and recreate the redirection
	# - If name is, it's only local so just edit config
	# - If "to" address, the API allows direct edition
	for k, v in redirs_config.items():
		if k == id:
			if v['alias'] != alias:
				old_alias = v['alias']
				remove_redir(old_alias)
				create_redir(name=name,
				 			 alias=alias,
							 to=to)
				break
				
			if v['name'] != name:
				redirs_config[id]['name'] = name
				write_config(redirs_config)

			if v['to'] != to:
				try:
					result = client.post("/email/domain/tical.fr/redirection"
						  				 f"/{id}/changeRedirection",
										 to=to)
					if result:
						redirs_config[id]['to'] = to
						write_config(redirs_config)

				except ovh.APIError as e:
					print(e)
			
			break


def remove_redir(alias: str):
	'''
		Create a new redirection
	'''
	id = None

	# Look for ID in local config, else query remote
	for k, v in redirs_config.items():
		if v['alias'] == alias:
			id = k
	
	if id == None:
		id = get_remote_id_by_alias(alias)

	# Delete remote, and then local if success
	try:
		result = client.delete(f'/email/domain/{domain}/redirection/{id}')
		if result:
			del redirs_config[id]
			write_config(redirs_config)
			print(f" {alias} alias removed.")

	except ovh.APIError as e:
		print(e)


def write_config(redirs_config: dict):
	'''
		Write local configuration changes into config.json
	'''
	config['redirection'] = redirs_config

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


def is_valid_email(email: str) -> bool:
	'''
		Verify if email format is valid
	'''
	pattern = r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
	
	if re.match(pattern, email):
		return True
	else:
		return False


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

redirs_config = config['redirection']
general_config = config['general']

# If local config is empty, try to retrieve
# an existing remote redirections
if len(redirs_config) < 1:
	redirs_config = get_redirs_remote()

# redirs_remote = get_redirs_remote()
# init_check(redirs_remote, redirs_config)

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
		for k, v in redirs_config.items():
			print(f'{k} -> {v}')
			# TODO tri : date de création > ordre alphab 
			# 			 du domaine > ordre alphab mail


	elif (action == "1"):
		print("Create a new redirection")
		name = input(" (optional) Name/description ? ")

		while True:
			hashq = input(" Use a hash (0) or readable (1)"
				 		  " redir address ? [0/1] ")
			if hashq == "0":
				print(" Hash ! (not implemented yet)")
				# TODO alias = randomize something
				# break
			elif hashq == "1":
				alias = input(" Alias e-mail address ? ")
			else :
				print(" Error, type is 0 (use a hashed/unreadable address)"
		  			  " or 1 (use a readable redirection address)")

			if alias and is_valid_email(alias) == True:
				break
			else:
				print(f" {alias} is not a valid e-mail format.")

		while True:
			if general_config['default_dest_addr']:
				to = input_w_prefill(" Destination e-mail address ? ",
							  	     v[general_config['default_dest_addr']])
			else :
				to = input(" Destination e-mail address ? ")

			if to and is_valid_email(to) == True:
				break

		create_redir(name, alias, to)


	elif (action == "2"):
		print("Edit an existing redirection")
		alias = input(" Alias e-mail address to edit ? ")
		id = None

		# Try to get id from config
		for k, v in redirs_config.items():
			if v['alias'] == alias:
				id = k
				break
		
		# If ID not in local config, make an API call
		if id == None:
			id = get_remote_id_by_alias(alias)

		if id == None:
			print(" Could not find {alias} alias.")
		
		else:
			for k, v in redirs_config.items():
				if (k == id):
					name = input_w_prefill("(optional) Name/description ? ",
											v['name'])
					hashq = input("Replace with a generated hash (0)"
				   				  "or edit alias manually (1) ? [0/1] ")
					if hashq == "0":
						print("hash ! (not implemented yet)")
						# TODO alias = randomize something
						# break
					elif hashq == "1":
						alias = input_w_prefill(" Alias e-mail address ? ",
												v['alias'])
					to = input_w_prefill(" Destination e-mail address ? ",
											v['to'])
					break
			
			if is_valid_email(alias) and is_valid_email(alias):
				edit_redir(id, name, alias, to)

	elif (action == "3"):
		print("Remove a redirection")
		alias = input(" Alias to remove (ex: spam24@tical.fr) ? ")
		remove_redir(alias)

	elif (action == "4"):
		print("Check+synchronize local configuration <-> OVH configuration")
		syncheck(redirs_remote=get_redirs_remote(),
	   		 	 redirs_config=redirs_config)
	
	elif (action == "q"):
		quit()
	else :
		print("Unknown action")