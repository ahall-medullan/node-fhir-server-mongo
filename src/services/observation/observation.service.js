/*eslint no-unused-vars: "warn"*/

const { RESOURCES } = require('@asymmetrik/node-fhir-server-core').constants;
const FHIRServer = require('@asymmetrik/node-fhir-server-core');
const { COLLECTION, CLIENT_DB } = require('../../constants');
const moment = require('moment-timezone');
const globals = require('../../globals');

const { stringQueryBuilder,
	tokenQueryBuilder,
	referenceQueryBuilder,
	addressQueryBuilder,
	nameQueryBuilder,
	dateQueryBuilder } = require('../../utils/querybuilder.util');

let getObservation = (base_version) => {
	return require(FHIRServer.resolveFromVersion(base_version || '3_0_1', RESOURCES.OBSERVATION));};

let getMeta = (base_version) => {
	return require(FHIRServer.resolveFromVersion(base_version|| '3_0_1', RESOURCES.META));};

module.exports.search = (args, context, logger) => new Promise((resolve, reject) => {
	logger.info('Observation >>> search');

	// Common search params
	let { base_version = '3_0_1', _content, _format, _id, _lastUpdated, _profile, _query, _security, _tag } = args;

	// Search Result params
	let { _INCLUDE, _REVINCLUDE, _SORT, _COUNT, _SUMMARY, _ELEMENTS, _CONTAINED, _CONTAINEDTYPED } = args;

	// Resource Specific params
	let based_on = args['based-on'];
	let category = args['category'];
	let code = args['code'];
	let code_value_concept = args['code-value-concept'];
	let code_value_date = args['code-value-date'];
	let code_value_quantity = args['code-value-quantity'];
	let code_value_string = args['code-value-string'];
	let combo_code = args['combo-code'];
	let combo_code_value_concept = args['combo-code-value-concept'];
	let combo_code_value_quantity = args['combo-code-value-quantity'];
	let combo_data_absent_reason = args['combo-data-absent-reason'];
	let combo_value_concept = args['combo-value-concept'];
	let combo_value_quantity = args['combo-value-quantity'];
	let component_code = args['component-code'];
	let component_code_value_concept = args['component-code-value-concept'];
	let component_code_value_quantity = args['component-code-value-quantity'];
	let component_data_absent_reason = args['component-data-absent-reason'];
	let component_value_concept = args['component-value-concept'];
	let component_value_quantity = args['component-value-quantity'];
	let _context = args['_context'];
	let data_absent_reason = args['data-absent-reason'];
	let date = args['date'];
	let device = args['device'];
	let encounter = args['encounter'];
	let identifier = args['identifier'];
	let method = args['method'];
	let patient = args['patient'];
	let subject = args['subject'];
	let performer = args['performer'];
	let related = args['related'];
	let related_target = args['related-target'];
	let related_type = args['related-type'];
	let specimen = args['specimen'];
	let status = args['status'];
	let reference = args['reference'];
	let value_concept = args['value-concept'];
	let value_date = args['value-date'];
	let value_quantity = args['value-quantity'];
	let value_string = args['value-string'];

	// TODO: Build query from Parameters
	let query = {};

	if (patient) {
		let queryBuilder = referenceQueryBuilder(patient, 'patient.reference');
		for (let i in queryBuilder) {
			query[i] = queryBuilder[i];
		}
	}
	if (subject) {
		let queryBuilder = referenceQueryBuilder(subject, 'subject.reference');
		for (let i in queryBuilder) {
			query[i] = queryBuilder[i];
		}
	}

	console.log('query is', query);

	// Grab an instance of our DB and collection
	let db = globals.get(CLIENT_DB);
	let collection = db.collection(`${COLLECTION.OBSERVATION}_${base_version}`);
	let Observation = getObservation(base_version);

	// Query our collection for this observation
	collection.find(query, (err, data) => {
		if (err) {
			logger.error('Error with Observation.search: ', err);
			return reject(err);
		}

		// Patient is a patient cursor, pull documents out before resolving
		data.toArray().then((observations) => {
			observations.forEach(function(element, i, returnArray) {
				returnArray[i] = new Observation(element);
			});
			resolve(observations);
		});
	});
});

module.exports.searchById = (args, context, logger) => new Promise((resolve, reject) => {
	logger.info('Observation >>> searchById', args);

	let { base_version = '3_0_1', id } = args;
	let Observation = getObservation(base_version);

	// Grab an instance of our DB and collection
	let db = globals.get(CLIENT_DB);
	let collection = db.collection(`${COLLECTION.OBSERVATION}_${base_version}`);
	// Query our collection for this observation
	collection.findOne({ id: id.toString() }, (err, model) => {
		if (err) {
			logger.error('Error with Observation.searchById: ', err);
			return reject(err);
		}
		if (model) {
			resolve(new Observation(model));
		}
		resolve();
	});
});

module.exports.create = (args, context, logger) => new Promise((resolve, reject) => {
	logger.info('Observation >>> create', args);

	let { base_version = '3_0_1', id, resource } = args;

	// Grab an instance of our DB and collection
	let db = globals.get(CLIENT_DB);
	let collection = db.collection(`${COLLECTION.OBSERVATION}_${base_version}`);

	// get current record
	let Observation = getObservation(base_version);
	let model = new Observation(resource);

	let Meta = getMeta(base_version);
	model.meta = new Meta({versionId: '1', lastUpdated: moment.utc().format('YYYY-MM-DDTHH:mm:ssZ')});

	let cleaned = JSON.parse(JSON.stringify(model.toJSON()));
	let doc = Object.assign(cleaned, { _id: id });

	// Insert/update our observation record
	collection.insertOne({ id: id }, { $set: doc }, { upsert: true }, (err2, res) => {
		if (err2) {
			logger.error('Error with Observation.create: ', err2);
			return reject(err2);
		}

		// save to history
		let history_collection = db.collection(`${COLLECTION.OBSERVATION}_${base_version}_History`);

		let history_model = Object.assign(cleaned, { _id: id + cleaned.meta.versionId });

		// Insert our observation record to history but don't assign _id
		return history_collection.insertOne(history_model, (err3) => {
			if (err3) {
				logger.error('Error with ObservationHistory.create: ', err3);
				return reject(err3);
			}

			return resolve({ id: res.value && res.value.id, created: res.lastErrorObject && !res.lastErrorObject.updatedExisting, resource_version: doc.meta.versionId });
		});

	});
	// Return Id
});

module.exports.update = (args, context, logger) => new Promise((resolve, reject) => {
	logger.info('Observation >>> update', args);

	let { base_version = '3_0_1', id, resource } = args;

	// Grab an instance of our DB and collection
	let db = globals.get(CLIENT_DB);
	let collection = db.collection(`${COLLECTION.OBSERVATION}_${base_version}`);

	// get current record
	// Query our collection for this observation
	collection.findOne({ id: id.toString() }, (err, data) => {
		if (err) {
			logger.error('Error with Observation.searchById: ', err);
			return reject(err);
		}

		let Observation = getObservation(base_version);
		let model = new Observation(resource);

		if (data && data.meta) {
			let foundModel = new Observation(data);
			let meta = foundModel.meta;
			meta.versionId = `${parseInt(foundModel.meta.versionId) + 1}`;
			model.meta = meta;
		} else {
			let Meta = getMeta(base_version);
			model.meta = new Meta({versionId: '1', lastUpdated: moment.utc().format('YYYY-MM-DDTHH:mm:ssZ')});
		}

		let cleaned = JSON.parse(JSON.stringify(model));
		let doc = Object.assign(cleaned, { _id: id });

		// Insert/update our model record
		collection.findOneAndUpdate({ id: id }, { $set: doc }, { upsert: true }, (err2, res) => {
			if (err2) {
				logger.error('Error with Observation.update: ', err2);
				return reject(err2);
			}

			// save to history
			let history_collection = db.collection(`${COLLECTION.OBSERVATION}_${base_version}_History`);

			let history_model = Object.assign(cleaned, { _id: id + cleaned.meta.versionId });

			// Insert our model record to history but don't assign _id
			return history_collection.insertOne(history_model, (err3) => {
				if (err3) {
					logger.error('Error with ObservationHistory.create: ', err3);
					return reject(err3);
				}

				return resolve({ id: doc.id, created: res.lastErrorObject && !res.lastErrorObject.updatedExisting, resource_version: doc.meta.versionId });
			});

		});
	});
});

module.exports.remove = (args, context, logger) => new Promise((resolve, reject) => {
	logger.info('Observation >>> remove');

	let { id } = args;

	// TODO: delete record in database (soft/hard)

	// Return number of records deleted
	resolve({ deleted: 0 });
});

module.exports.searchByVersionId = (args, context, logger) => new Promise((resolve, reject) => {
	logger.info('Observation >>> searchByVersionId');

	let { base_version = '3_0_1', id, version_id } = args;

	let Observation = getObservation(base_version);

	// TODO: Build query from Parameters

	// TODO: Query database

	// Cast result to Observation Class
	let observation_resource = new Observation();

	// Return resource class
	resolve(observation_resource);
});

module.exports.history = (args, context, logger) => new Promise((resolve, reject) => {
	logger.info('Observation >>> history');

	// Common search params
	let { base_version = '3_0_1', _content, _format, _id, _lastUpdated, _profile, _query, _security, _tag } = args;

	// Search Result params
	let { _INCLUDE, _REVINCLUDE, _SORT, _COUNT, _SUMMARY, _ELEMENTS, _CONTAINED, _CONTAINEDTYPED } = args;

	// Resource Specific params
	let based_on = args['based-on'];
	let category = args['category'];
	let code = args['code'];
	let code_value_concept = args['code-value-concept'];
	let code_value_date = args['code-value-date'];
	let code_value_quantity = args['code-value-quantity'];
	let code_value_string = args['code-value-string'];
	let combo_code = args['combo-code'];
	let combo_code_value_concept = args['combo-code-value-concept'];
	let combo_code_value_quantity = args['combo-code-value-quantity'];
	let combo_data_absent_reason = args['combo-data-absent-reason'];
	let combo_value_concept = args['combo-value-concept'];
	let combo_value_quantity = args['combo-value-quantity'];
	let component_code = args['component-code'];
	let component_code_value_concept = args['component-code-value-concept'];
	let component_code_value_quantity = args['component-code-value-quantity'];
	let component_data_absent_reason = args['component-data-absent-reason'];
	let component_value_concept = args['component-value-concept'];
	let component_value_quantity = args['component-value-quantity'];
	let _context = args['_context'];
	let data_absent_reason = args['data-absent-reason'];
	let date = args['date'];
	let device = args['device'];
	let encounter = args['encounter'];
	let identifier = args['identifier'];
	let method = args['method'];
	let patient = args['patient'];
	let performer = args['performer'];
	let related = args['related'];
	let related_target = args['related-target'];
	let related_type = args['related-type'];
	let specimen = args['specimen'];
	let status = args['status'];
	let reference = args['reference'];
	let value_concept = args['value-concept'];
	let value_date = args['value-date'];
	let value_quantity = args['value-quantity'];
	let value_string = args['value-string'];

	// TODO: Build query from Parameters

	// TODO: Query database

	let Observation = getObservation(base_version);

	// Cast all results to Observation Class
	let observation_resource = new Observation();

	// Return Array
	resolve([observation_resource]);
});

module.exports.historyById = (args, context, logger) => new Promise((resolve, reject) => {
	logger.info('Observation >>> historyById');

	// Common search params
	let { base_version = '3_0_1', _content, _format, _id, _lastUpdated, _profile, _query, _security, _tag } = args;

	// Search Result params
	let { _INCLUDE, _REVINCLUDE, _SORT, _COUNT, _SUMMARY, _ELEMENTS, _CONTAINED, _CONTAINEDTYPED } = args;

	// Resource Specific params
	let based_on = args['based-on'];
	let category = args['category'];
	let code = args['code'];
	let code_value_concept = args['code-value-concept'];
	let code_value_date = args['code-value-date'];
	let code_value_quantity = args['code-value-quantity'];
	let code_value_string = args['code-value-string'];
	let combo_code = args['combo-code'];
	let combo_code_value_concept = args['combo-code-value-concept'];
	let combo_code_value_quantity = args['combo-code-value-quantity'];
	let combo_data_absent_reason = args['combo-data-absent-reason'];
	let combo_value_concept = args['combo-value-concept'];
	let combo_value_quantity = args['combo-value-quantity'];
	let component_code = args['component-code'];
	let component_code_value_concept = args['component-code-value-concept'];
	let component_code_value_quantity = args['component-code-value-quantity'];
	let component_data_absent_reason = args['component-data-absent-reason'];
	let component_value_concept = args['component-value-concept'];
	let component_value_quantity = args['component-value-quantity'];
	let _context = args['_context'];
	let data_absent_reason = args['data-absent-reason'];
	let date = args['date'];
	let device = args['device'];
	let encounter = args['encounter'];
	let identifier = args['identifier'];
	let method = args['method'];
	let patient = args['patient'];
	let performer = args['performer'];
	let related = args['related'];
	let related_target = args['related-target'];
	let related_type = args['related-type'];
	let specimen = args['specimen'];
	let status = args['status'];
	let reference = args['reference'];
	let value_concept = args['value-concept'];
	let value_date = args['value-date'];
	let value_quantity = args['value-quantity'];
	let value_string = args['value-string'];

	// TODO: Build query from Parameters

	// TODO: Query database

	let Observation = getObservation(base_version);

	// Cast all results to Observation Class
	let observation_resource = new Observation();

	// Return Array
	resolve([observation_resource]);
});

