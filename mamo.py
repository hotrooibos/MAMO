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

def init_check(redirs_remote: list, redirs_config: list):
	'''
		Check if the the whole local (config.json) informations
		are equals to the remote (ovh api) informations
	'''

	if (len(redirs_config) != len(redirs_remote)):
		print("WARNING : local config length DIFFERS from remote !")

	print("\nCheck config...")
	for id, v in redirs_config.items():
		synchro_check(id)

	print("\nCheck remote...")
	for id in redirs_remote:
		synchro_check(id)
	print("\n")

def synchro_check(id: int):
	'''
		Check if the local (config.json) informations for the given id
		is equals to the remote (ovh api) informations
	'''
	# Check config
	for k, v in redirs_config.items():
		if k == id:
			if k in redirs_remote:
				print(k + " :")
				print("    config " + redirs_config[k]["alias"])
				print("    remote " + redirs_remote[k]["alias"])
				# print(f"yes -> {k} -> {v}")
			else:
				print(f"no -> {k} -> {v}")
	
	# Check remote
	# TODO

def create_redir(name:str, alias: str, to: str):
	'''
		Create a new redirection
	'''
	# Create redir in remote config
	result = client.post(f'/email/domain/{domain}/redirection', 
						 f'{{"from":"{alias}{domain}", "localCopy":false, "to":"{to}"}}')

	redirs_remote = client.get(f'/email/domain/{domain}/redirection')

	# Update the local config with the remote informations
	for id in redirs_remote:
		r = client.get(f'/email/domain/{domain}/redirection/{id}')

		# Local config : add the local infos (name/date)
		# of the newly created redirection
		if r["from"] == alias:
			redirs_remote[r["id"]] = {
				"name": name,
				"date": time.time(),
				"alias": alias,
				"to": to,
			}

		with open(file=CONFIG,
				mode='w',
				encoding='utf-8') as json_file:
			json.dump(redirs_remote, json_file, indent=4)


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

redir_remote_ids = client.get(f'/email/domain/{domain}/redirection')
redirs_remote = get_redirs_remote()
redirs_config = config["redirection"]
init_check(redirs_remote, redirs_config)


# Main loop
while (True):
	action = input("0 : show/refresh remote redirections\n1 : create redir\n2 : mod redir\n3 : remove redir\n>> ")

	if (action == "0"):
		redirs_remote = get_redirs_remote()

		for k, v in redirs_remote.items():
			print(f'{k} -> {v}')
			# TODO si id n'existe pas dans json, le créer
			# synchro_check(k)
			# TODO tri : date de création > ordre alphab du domaine > ordre alphab mail

	elif (action == "1"):
		print("Create a new redirection")
		name = input("Label/name/website ? (ex: amazin.com) >> ")
		hashq = input("Use a hash (0) or readable (1) redir adress ? [0/1]")

		while hashq not in (0,1):
			if hashq == 0:
				print("hash ! (not implemented yet)")
				# TODO alias = randomize something
				# break
			elif hashq == 1:
				alias = input(f"Alias ? (ex: john@spam2024 for john@spam2024@{domain}) >> ")
				break
			else :
				print("Error, type is 0 (use a hashed/unreadable address) or 1 (use a readable redirection address)")

		to = input("Destination ? (ex: john@doe.com) >> ")

		create_redir(name, alias, to)


	elif (action == "2"):
		print("Edit an existing redirection")
		id = input("ID of the redir to edit ? ")

		for k, v in redirs_remote.items():
			if (k == id):
				id = k
				fm = v[0]
				to = v[1]
				synchro_check(id)
				break

		dest = input("New destination (ex: john@doe.com) ? ")
		# desc = input(f"Description ?\nCurrent description : {}")
		epoch = time.time()
		# TODO Mod la redir via l'api
		# TODO Mod la conf à l'id : date, from, to

	elif (action == "3"):
		print("rm...")
	else :
		print("Unknown action")


# OVH tokens management
# Generate new credentials with full access to your account on the token creation
# page (https://api.ovh.com/createToken/index.cgi?GET=/*&PUT=/*&POST=/*&DELETE=/*)
# import utils
# utils.list_ovh_tokens(client)
# utils.delete_ovh_token(client, "0000")
# utils.purge_ovh_tokens(client)