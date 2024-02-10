# -*- encoding: utf-8 -*-
import json
import os
import ovh
import time

ROOTDIR = os.path.dirname(os.path.abspath(__file__))
CONFIG = ROOTDIR + "/config.json"
domain = "tical.fr"


def get_redirs_remote() -> dict:
	'''
		Download remote redirections and return it as a dict
	'''
	print("Retrieving redirections from OVH...")
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


def syncheck(redirs_remote: list, redirs_config: list):
	'''
		Check if the the whole local (config.json) informations
		are equals to the remote (ovh api) informations
	'''

	if (len(redirs_config) != len(redirs_remote)):
		print("WARNING : local config length DIFFERS from remote !")

	# Loop in the local config
	print("\nCheck config...")
	for id, v in redirs_config.items():
		try:
			compare(id, redirs_config[id], redirs_remote[id])
		except KeyError:
			action = input(f" Redirection [{v['alias']}@{domain} -> {v['to']}] unknown in remote config. Create it ? [y/N]")
			if action == "y":
				print("TODO create a remote entry")
				continue
			else:
				continue

	# Loop in the remote config
	print("\nCheck remote...")
	for id, v in redirs_remote.items():
		try:
			compare(id, redirs_config[id], redirs_remote[id])
		except KeyError:
			action = input(f" Redirection [{v['alias']}@{domain} -> {v['to']}] unknown in local config. Create it ? [y/N]")
			if action == "y":
				print("TODO create a local entry")
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
		print(f" Compare {id}: alias differs (local {config_data['alias']} <> remote {remote_data['alias']})")
		result += 1

	if config_data['to'] != remote_data['to']:
		print(f" Compare {id}: to differs (local {config_data['to']} <> remote {remote_data['to']})")
		result += 2
	
	return result

	# for k, v in redirs_config.items():
	# 	if k == id:
	# 		if k in redirs_remote:
	# 			print(k + " :")
	# 			print("    config " + redirs_config[k]["alias"])
	# 			print("    remote " + redirs_remote[k]["alias"])
	# 			# print(f"yes -> {k} -> {v}")
	# 		else:
	# 			print(f"no -> {k} -> {v}")
	


def create_redir(name:str, alias: str, to: str):
	'''
		Create a new redirection
	'''
	print("CREATE REDIR")
	print(f"from: {alias}{domain}")
	print(f"to: {to}")

	# Create redir in remote config
	# result = client.post(f'/email/domain/{domain}/redirection', 
	# 					 f'{{"from":"{alias}{domain}", "localCopy":false, "to":"{to}"}}')
	
	
	result = client.post(
						'/email/domain/tical.fr/redirection',
					   	_from=alias + domain,
						localCopy=False,
						to=to
						)
	print(f"creation result :\n{result}")

	# # Local config : add the local infos (name/date)
	# # of the newly created redirection
	# if r["from"] == alias:
	# 	redirs_remote[r["id"]] = {
	# 		"name": name,
	# 		"date": time.time(),
	# 		"alias": alias,
	# 		"to": to,
	# 	}

	# with open(file=CONFIG,
	# 		mode='w',
	# 		encoding='utf-8') as json_file:
	# 	json.dump(redirs_remote, json_file, indent=4)


# Read config file
with open(file=CONFIG,
		  mode='r',
          encoding='utf-8') as json_file:
	config = json.load(json_file)

# Instantiate an OVH Client
client = ovh.Client(
	endpoint = config["token"]["endpoint"],
	application_key = config["token"]["app_key"],
	application_secret = config["token"]["app_secret"],
	consumer_key = config["token"]["consumer_key"],
)

redirs_config = config["redirection"]
general_config = config["general"]

# If local config is empty, try to retrieve
# an existing remote redirections
if len(redirs_config) < 1:
	redirs_config = get_redirs_remote()

# redirs_remote = get_redirs_remote()
# init_check(redirs_remote, redirs_config)


# Main loop
while (True):
	print("""======================================
Mail Alias Manager for OVH - MAMO v0.1
Copyright(c) 2024 Antoine Marzin
======================================
 Menu :
  [0] Display redirections
  [1] Create a new redirection
  [2] Edit an existing redirection
  [3] Remove a redirection
  [4] Check/synchronize local configuration with remote (OVH) redirections
  [q] Exit""")
	action = input(">> ")


	if (action == "0"):
		for k, v in redirs_config.items():
			print(f'{k} -> {v}')
			# TODO tri : date de création > ordre alphab du domaine > ordre alphab mail


		# redirs_remote = get_redirs_remote()
		# for k, v in redirs_remote.items():
		# 	print(f'{k} -> {v}')

	elif (action == "1"):
		print("Create a new redirection")
		name = input("(optional) Label/name/website ? (ex: amazin.com) >> ")

		while True:
			hashq = input("Use a hash (0) or readable (1) redir adress ? [0/1]")
			if hashq == "0":
				print("hash ! (not implemented yet)")
				# TODO alias = randomize something
				# break
			elif hashq == "1":
				alias = input(f"Alias ? (ex: john@spam2024. for john@spam2024@{domain}) >> ")
				break
			else :
				print("Error, type is 0 (use a hashed/unreadable address) or 1 (use a readable redirection address)")
		

		while True:
			if general_config['default_dest_addr']:
				to = input(f"Destination ? [{general_config['default_dest_addr']}] >> ")
				if to == "":
					to = general_config['default_dest_addr']
					break
			else :
				to = input("Destination ? (ex: john@doe.com) >> ")

			if to:
				break

		create_redir(name, alias, to)


	elif (action == "2"):
		print("Edit an existing redirection")
		id = input("ID of the redir to edit ? ")

		for k, v in redirs_remote.items():
			if (k == id):
				id = k
				fm = v[0]
				to = v[1]
				break

		dest = input("New destination (ex: john@doe.com) ? ")
		# desc = input(f"Description ?\nCurrent description : {}")
		epoch = time.time()
		# TODO Mod la redir via l'api
		# TODO Mod la conf à l'id : date, from, to

	elif (action == "3"):
		print("Remove a redirection")
		print("To be implemented...")
	elif (action == "4"):
		print("Check and synchronize local configuration <-> OVH configuration")
		syncheck(redirs_remote=get_redirs_remote(),
	   		 	 redirs_config=redirs_config)
	elif (action == "q"):
		quit()
	else :
		print("Unknown action")