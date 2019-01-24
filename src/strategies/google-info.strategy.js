const Strategy = require('passport-http-bearer').Strategy;
const request = require('superagent');
const env = require('var');

/**
 * Bearer Strategy
 *
 * This strategy will handle requests with BearerTokens.  This is only a template and should be configured to
 * your AuthZ server specifications.
 *
 * Requires ENV variables for introspecting the token
 */
module.exports.strategy = new Strategy(
    function(token, done) {
		if (!env.INTROSPECTION_URL) {
			return done(new Error('Invalid introspection endpoint.'));
		}

		request
		.post(env.INTROSPECTION_URL)
		.set('content-type', 'application/x-www-form-urlencoded')
		.send({ id_token: token })
		.then((introspectionResponse) => {
			const decoded_token = introspectionResponse.body;

			console.log(JSON.stringify(decoded_token));

			if (decoded_token.active) {
				// TODO: context could come in many forms, you need to decide how to handle it.
				// it could also be decodedToken.patient etc...
				let { scope, context, sub, user_id } = decoded_token;
				let user = {user_id, sub};

				// return scopes and context.  Both required
				return done(null, user, {scope, context});
			}

			if (decoded_token.aud === env.CLIENT_ID) {
				// TODO: context could come in many forms, you need to decide how to handle it.
				// it could also be decodedToken.patient etc...
				let { scope, context, sub, user_id } = decoded_token;
				let user = { user_id: user_id || sub, sub };

				// return scopes and context.  Both required
				return done(null, user, { scope, context: context || 'patient' });
			}

			// default return unauthorized
			return done(new Error('Invalid token'));
		});
	}
);
