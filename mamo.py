# -*- encoding: utf-8 -*-
import eel
import json
import model
import strings
import utils
import uuid

'''	EEL exposed functions
	Called from JavaScript

'''

@eel.expose
def get_redirs() -> str:
    r = model.get_redirs()
	# TODO tri : date de création > ordre alphab 
	# 			 du domaine > ordre alphab mail
    return r

@eel.expose
def set_redir(form: str) -> int:
	f = json.loads(form)
	name = f['name']
	alias = f['alias']
	to = f['to']
	
	r = model.create_redir(name=name,
						   alias=alias,
						   to=to)
	return r

@eel.expose
def get_uuid() -> str:
    r = uuid.uuid4().hex + f"@{model.domain}"
    return r

@eel.expose
def del_redir(form:str) -> str:
	f = json.loads(form)
	alias = f['alias']
	r = model.remove_redir(alias)
	return r


'''	Main app

'''

# If local config is empty, try to retrieve
# an existing remote redirections
if len(model.config_redir) < 1:
	model.config_redir = model.get_redirs_remote()

# redirs_remote = get_redirs_remote()
# init_check(redirs_remote, config_redir)


# Start Eel web UI
eel.init('web')
eel.start('templates/index.j2',
		  size=(300, 200),
		  jinja_templates='templates',
		  mode='default',
		  port=8080)



'''	CLI
	Should/will be part of a specific module
	As of now, it offers more working functions than web ui
	Comment the above eel init/start to use CLI

'''

print("""======================================
Mail Alias Manager for OVH - MAMO v0.2
Copyright(c) 2024 Antoine Marzin
======================================
 Menu :
  [0] Display redirections
  [1] Create a new redirection
  [2] Edit an existing redirection
  [3] Remove a redirection
  [4] DRY Check/synchronize local configuration with remote (OVH) redirections
  [5] Check/synchronize local configuration with remote (OVH) redirections
  [q] Exit""")

# Main loop
while (True):
	action = input(">> ")


	if (action == "0"):
		print(f" {len(model.config_redir)} entries found.\n---")
		for k, v in model.config_redir.items():
			print(f' {k} -> {v}')
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
		print("DRY Check + synchronize local configuration <-> OVH configuration")
		model.syncheck(redirs_remote=model.get_redirs_remote(),
	   		 	 	   config_redir=model.config_redir,
					   dry=True)

	elif (action == "5"):
		print("Check + synchronize local configuration <-> OVH configuration")
		model.syncheck(redirs_remote=model.get_redirs_remote(),
	   		 	 	   config_redir=model.config_redir)

	elif (action == "q"):
		quit()
	else :
		print("Unknown action")