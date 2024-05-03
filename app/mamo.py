# -*- encoding: utf-8 -*-
import json
import model
import quart as qr
from werkzeug.datastructures import MultiDict 

app = qr.Quart(__name__,
               template_folder='../templates',
               static_folder='../static')

# DEV : reload on template change
app.config['TEMPLATES_AUTO_RELOAD'] = True

# Jinja presets to avoid weird HTML formating
app.jinja_env.trim_blocks = True
app.jinja_env.lstrip_blocks = True


"""	Views

"""

@app.route('/')
async def index():
	def_dest = model.default_dest_addr
	domains = model.domains
	redirs = model.get_redirs()
	# TODO tri : date de création > ordre alphab 
	# 			 du domaine > ordre alphab mail
	return await qr.render_template('index.j2',
								 	def_dest=def_dest,
								 	domains=domains,
									redirs=redirs)


@app.route('/get_domains')
async def get_domains() -> str:
	try:
		domains = model.domains
		return domains, 200

	except Exception as e:
		return str(e), 400


@app.route('/get_redirs', methods=['POST'])
async def get_redirs() -> str:
	try:
		body = await qr.request.data
		b = json.loads(body)
		selected_domain = b
		redirs = model.get_redirs(selected_domain)
		return redirs, 200

	except Exception as e:
		return str(e), 400


@app.route('/syn_check', methods=['POST'])
async def syn_check() -> str:
	body = await qr.request.data
	b = json.loads(body)
	selected_domain = b

	try:
		res = model.syncheck(redirs_remote=model.get_redirs_remote(selected_domain),
							 config_redir=model.config_redir)
	
		# Convert "res" tuple to JSON formatted str
		return json.dumps(res), 200
	
	except Exception as e:
		return str(e), 400


@app.route('/set_redir', methods=['POST'])
async def set_redir() -> str:
	form = await qr.request.data
	print(f"FORM : {form}")
	f = json.loads(form)
	name = f['name']
	alias = f['alias'].lower()
	to = f['to'].lower()
	
	try:
		res = model.create_redir(name=name,
						   		 alias=alias,
						   		 to=to)
		return str(res), 200
	
	except Exception as e:
		return str(e), 400


@app.route('/edit_redir', methods=['POST'])
async def edit_redir() -> str:
	form = await qr.request.data
	f = json.loads(form)
	id = f['id']
	name = f['name']
	alias = f['alias']
	to = f['to']
	
	try:
		model.edit_redir(id=id,
						 name=name,
						 alias=alias,
						 to=to)
		return "Alias edited succesfully", 200
	
	except Exception as e:
		return str(e), 400


@app.route('/del_redir', methods=['POST'])
async def del_redir() -> str:
	del_arr = await qr.request.data
	del_arr = json.loads(del_arr)

	# TODO using an array for future bulk deletion
	# atm, there will only be one id in the del_arr
	try:
		for id in del_arr:
			res = model.remove_redir(id)

		return str(res), 200

	except Exception as e:
		return str(e), 400


@app.route('/gen_name', methods=['POST'])
async def gen_name() -> str:
	try:
		r = model.generate_name()

		return r, 200

	except Exception as e:
		return str(e), 400


"""	Main app

"""
# If local config is empty, try to retrieve
# an existing remote redirections
if len(model.config_redir) < 1:
	model.config_redir = model.get_redirs_remote()

# redirs_remote = get_redirs_remote()
# init_check(redirs_remote, config_redir)


# Start web view with (Quart ASGI server)
# if __name__ == "__main__":
#     app.run(debug=True)



"""	CLI
	Should/will be part of a specific module
	As of now, it offers more working functions than web ui
	Comment the above eel init/start to use CLI

"""

# print("""======================================
# Mail Alias Manager for OVH - MAMO v0.2
# Copyright(c) 2024 Antoine Marzin
# ======================================
#  Menu :
#   [0] Display redirections
#   [1] Create a new redirection
#   [2] Edit an existing redirection
#   [3] Remove a redirection
#   [4] DRY Check/synchronize local configuration with remote (OVH) redirections
#   [5] Check/synchronize local configuration with remote (OVH) redirections
#   [q] Exit""")

# # Main loop
# while (True):
# 	action = input(">> ")


# 	if (action == "0"):
# 		print(f" {len(model.config_redir)} entries found.\n---")
# 		for k, v in model.config_redir.items():
# 			print(f' {k} -> {v}')
# 			# TODO tri : date de création > ordre alphab 
# 			# 			 du domaine > ordre alphab mail


# 	elif (action == "1"):
# 		print("Create a new redirection")
# 		name = input(strings.PROMPT_NAME)

# 		while True:
# 			uuidq = input(strings.PROMPT_UUID)
			
# 			if uuidq in ("0","1"):
# 				break
# 			else:
# 				print(strings.ERR_HASH)

# 		if uuidq == "0":
# 			alias = uuid.uuid4().hex + f"@{model.domain}"
		
# 		if uuidq == "1":
# 			while True:
# 				alias = input(strings.PROMPT_ALIAS)
# 				if alias and utils.is_valid_email(alias) == True:
# 					# TODO check si l'alias n'existe pas déjà
# 					break
# 				print(strings.err_not_valid_email(alias))

# 		while True:
# 			if model.config_general['default_dest_addr']:
# 				to = utils.input_w_prefill(strings.PROMPT_DEST,
# 							  	     model.config_general['default_dest_addr'])
# 			else :
# 				to = input(" Destination address ? ")

# 			if to and utils.is_valid_email(to) == True:
# 				break
# 			print(strings.err_not_valid_email(to))

# 		model.create_redir(name, alias, to)


# 	elif (action == "2"):
# 		print("Edit an existing redirection")
# 		id = 0

# 		while True:
# 			alias = input(strings.PROMPT_ALIAS)
# 			to = input(strings.PROMPT_DEST)

# 			if alias == "":
# 				continue

# 			if utils.is_valid_email(alias) == True:
# 				id = model.find_id(alias, to)
# 				break
# 			else:
# 				print(strings.err_not_valid_email(alias))
# 				continue

# 		if id == None:
# 			print(strings.cant_find_alias(alias))
# 			continue

# 		redir = model.config_redir[id]
# 		name = utils.input_w_prefill(strings.PROMPT_NAME,
# 							   redir['name'])
# 		while True:
# 			uuidq = input(strings.PROMPT_UUID)
			
# 			if uuidq in ("0","1"):
# 				break
# 			else:
# 				print(strings.ERR_HASH)

# 		if uuidq == "0":
# 			alias = uuid.uuid4().hex + f"@{model.domain}"
		
# 		if uuidq == "1":
# 			while True:
# 				alias = utils.input_w_prefill(strings.PROMPT_ALIAS, redir['alias'])
# 				if alias and utils.is_valid_email(alias) == True:
# 					# TODO check si l'alias n'existe pas déjà
# 					break
# 				print(strings.err_not_valid_email(alias))

# 		while True:
# 			to = utils.input_w_prefill(strings.PROMPT_DEST, redir['to'])
# 			if to and utils.is_valid_email(to) == True:
# 				break
# 			print(strings.err_not_valid_email(to))

# 		model.edit_redir(id, name, alias, to)

# 	elif (action == "3"):
# 		print("Remove a redirection")
# 		while True:
# 			alias = input(strings.PROMPT_ALIAS)
# 			to = input(strings.PROMPT_DEST)

# 			if utils.is_valid_email(alias) == True:
# 				id = model.find_id(alias, to)
# 			else:
# 				print(strings.err_not_valid_email(alias))
# 				continue

# 			if id == 0:
# 				print(strings.cant_find_alias(alias))
# 				break
# 			else:
# 				model.remove_redir(alias)
# 				break


# 	elif (action == "4"):
# 		print("DRY Check + synchronize local configuration <-> OVH configuration")
# 		model.syncheck(redirs_remote=model.get_redirs_remote(),
# 	   		 	 	   config_redir=model.config_redir,
# 					   dry=True)

# 	elif (action == "5"):
# 		print("Check + synchronize local configuration <-> OVH configuration")
# 		model.syncheck(redirs_remote=model.get_redirs_remote(),
# 	   		 	 	   config_redir=model.config_redir)

# 	elif (action == "q"):
# 		quit()
# 	else :
# 		print("Unknown action")