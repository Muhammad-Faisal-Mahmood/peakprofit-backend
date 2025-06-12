// Libraries
const nodemailer = require("nodemailer");
const fs = require("fs");
const handlebars = require("handlebars");
const { replaceOne } = require("../user/user.model");

function createTransport() {
	return nodemailer.createTransport({
		host: process.env.MAIL_HOST,
		secureConnection: false,
		port: process.env.MAIL_PORT,
		auth: {
			user: process.env.MAIL_EMAIL,
			pass: process.env.MAIL_PASSWORD,
		},
		maxMessages: 50,
	});

}

async function verifyTransport(transport) {
	let res;
	await transport.verify(function (error, success) {
		if (error) {
			console.log(error);
			res = error;
		} else {
			res = success;
			console.log("Server is ready to take our messages");
		}
	});

	return res;
}

function generateHtmlToSend(filePath, replacements) {
	const source = fs.readFileSync(filePath, "utf-8").toString();
	const template = handlebars.compile(source);
	return template(replacements);
}

function setMailOptions(email, subject, fileName, replacements, attachments, html = null) {
	return (mailOptions = {
		from: process.env.MAIL_FROM,
		to: email,
		subject: subject,
		html: html == null ? generateHtmlToSend(fileName, replacements) : html,
		attachments: attachments
	});
}

async function sendEmail(
	subject,
	fileName,
	email,
	replacements,
	html = null,
	attachments = null
) {
	var transport = createTransport();
	var transportVerify = await verifyTransport(transport);
	const mailOptions = setMailOptions(
		email,
		subject,
		fileName,
		replacements,
		attachments,
		// {
		//   ...replacements,
		//   ...{ environment: process.env.auth0Env == "sa-prod2" ? true : false },
		// },
		html
	);

	await transport.sendMail(mailOptions, function (error, info) {
		if (error) {
			console.log(error);
		} else {
			console.log("Email sent: " + info.response);
		}
	});
}

module.exports = { sendEmail };

