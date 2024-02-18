# -*- encoding: utf-8 -*-
import eel
import model
import strings
import utils
import uuid


@eel.expose
def get_redirs() -> str:
    r = model.get_redirs()
	# TODO tri : date de création > ordre alphab 
	# 			 du domaine > ordre alphab mail
    return r

@eel.expose
def get_uuid() -> str:
    r = uuid.uuid4().hex + f"@{model.domain}"
    return r



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
			model.compare(id, config_redir[id], redirs_remote[id])

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
			model.compare(id, config_redir[id], redirs_remote[id])
		except KeyError:
			action = input(f" Redirection {id} [{v['alias']} -> {v['to']}]"
				  		 	" unknown in local config. Create it ? [y/N]")
			if action == "y":
				print(" TODO create a local entry")
				continue
			else:
				continue



# If local config is empty, try to retrieve
# an existing remote redirections
if len(model.config_redir) < 1:
	model.config_redir = model.get_redirs_remote()

# redirs_remote = get_redirs_remote()
# init_check(redirs_remote, config_redir)

# eel.init('web')
# eel.start('templates/index.j2',
# 		  size=(300, 200),
# 		  jinja_templates='templates',
# 		  mode='default',
# 		  port=8080)


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
		for k, v in model.config_redir.items():
			print(f'{k} -> {v}')
			# TODO tri : date de création > ordre alphab 
			# 			 du domaine > ordre alphab mail


	elif (action == "1"):
		print("Create a new redirection")
		name = input(strings.PROMPT_NAME)

		while True:
			uuidq = input(strings.PROMPT_UUID)
			
			if uuidq in ("0","1"):
				break
			else:
				print(strings.ERR_HASH)

		if uuidq == "0":
			alias = uuid.uuid4().hex + f"@{model.domain}"
		
		if uuidq == "1":
			while True:
				alias = input(strings.PROMPT_ALIAS)
				if alias and utils.is_valid_email(alias) == True:
					# TODO check si l'alias n'existe pas déjà
					break
				print(strings.err_not_valid_email(alias))

		while True:
			if model.config_general['default_dest_addr']:
				to = utils.input_w_prefill(strings.PROMPT_DEST,
							  	     model.config_general['default_dest_addr'])
			else :
				to = input(" Destination address ? ")

			if to and utils.is_valid_email(to) == True:
				break
			print(strings.err_not_valid_email(to))

		model.create_redir(name, alias, to)


	elif (action == "2"):
		print("Edit an existing redirection")
		id = 0

		while True:
			alias = input(strings.PROMPT_ALIAS)

			if alias == "":
				continue

			if utils.is_valid_email(alias) == True:
				id = model.find_id_by_alias(alias)
				break
			else:
				print(strings.err_not_valid_email(alias))
				continue

		if id == None:
			print(strings.cant_find_alias(alias))
			continue

		redir = model.config_redir[id]
		name = utils.input_w_prefill(strings.PROMPT_NAME,
							   redir['name'])
		while True:
			uuidq = input(strings.PROMPT_UUID)
			
			if uuidq in ("0","1"):
				break
			else:
				print(strings.ERR_HASH)

		if uuidq == "0":
			alias = uuid.uuid4().hex + f"@{model.domain}"
		
		if uuidq == "1":
			while True:
				alias = utils.input_w_prefill(strings.PROMPT_ALIAS, redir['alias'])
				if alias and utils.is_valid_email(alias) == True:
					# TODO check si l'alias n'existe pas déjà
					break
				print(strings.err_not_valid_email(alias))

		while True:
			to = utils.input_w_prefill(strings.PROMPT_DEST, redir['to'])
			if to and utils.is_valid_email(to) == True:
				break
			print(strings.err_not_valid_email(to))

		model.edit_redir(id, name, alias, to)

	elif (action == "3"):
		print("Remove a redirection")
		while True:
			alias = input(strings.PROMPT_ALIAS)

			if utils.is_valid_email(alias) == True:
				id = model.find_id_by_alias(alias)
			else:
				print(strings.err_not_valid_email(alias))
				continue

			if id == 0:
				print(strings.cant_find_alias(alias))
				break
			else:
				model.remove_redir(alias)
				break


	elif (action == "4"):
		print("Check + synchronize local configuration <-> OVH configuration")
		syncheck(redirs_remote=model.get_redirs_remote(),
	   		 	 config_redir=model.config_redir)
	
	elif (action == "q"):
		quit()
	else :
		print("Unknown action")