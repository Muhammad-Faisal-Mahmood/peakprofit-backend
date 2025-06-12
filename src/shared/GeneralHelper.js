// Bacrypt
const bcrypt = require("bcryptjs");

//Moment
const moment = require("moment");

// Constants
const General = require("./General");

async function bcryptPassword(password) {
	return await bcrypt.hash(password, 10);
}

async function comparePassword(enteredPassword, userPassword) {
	return await bcrypt.compare(enteredPassword, userPassword);
}

function escapeLike(string) {
	return string
		.replace("#", "\\#")
		.replace("$", "\\$")
		.replace("%", "\\%")
		.replace("+", "\\+")
		.replace("_", "\\_");
}

function makeRegex(searchValue) {
	searchValue = escapeLike(searchValue);
	return new RegExp(searchValue, "i");
}

function isValueSet(value) {
	return !(value == "" || value == null || value == undefined);
}

function isValueNotSet(value) {
	return value == "" || value == null || value == undefined;
}

function getPageSize() {
	return 10;
}

function getSkipCount(pageNo, pageSize) {
	return (pageNo - 1) * pageSize;
}

function checkPageLowerLimit(pageNo) {
	return pageNo < 1 ? 1 : pageNo;
}

function getPaginationDetails(pageNo) {
	return {
		pageNo: checkPageLowerLimit(pageNo),
		pageSize: getPageSize(),
		skip: getSkipCount(pageNo, getPageSize()),
	};
}

function makePaginationObject(
	pageNo,
	pageSize,
	skip,
	total,
	currentPageRecords
) {
	return {
		currentPage: pageNo,
		pageSize: pageSize,
		from: skip == 0 ? 1 : skip + 1,
		to: currentPageRecords + (pageNo == 1 ? 0 : (pageNo - 1) * pageSize),
		total: total,
	};
}

function getFrontAppUrl() {
	return process.env.MODE == "DEV"
		? process.env.FRONT_APP_URL_DEV
		: process.env.FRONT_APP_URL_PRO;
}

function getFrontAppResetUrl() {
	return process.env.MODE == "DEV"
		? process.env.FRONT_APP_RESET_PASSWORD_URL_DEV
		: process.env.FRONT_APP_RESET_PASSWORD_URL_PRO;
}

function getFrontAppSetUrl() {
	return process.env.MODE == "DEV"
		? process.env.FRONT_APP_SET_PASSWORD_URL_DEV
		: process.env.FRONT_APP_SET_PASSWORD_URL_PRO;
}

function getBackAppUrl() {
	return process.env.MODE == "DEV"
		? process.env.BACK_APP_URL_DEV
		: process.env.BACK_APP_URL_PRO;
}

function makeImagePath(dir, name) {
	return dir + "/" + name;
}

function makeFilePath(dir, name) {
	return dir + "/" + name;
}

function passwordGenerator() {
	return (
		"AK" + Math.floor(Math.random() * (999999 - 111111) + 111111) + "roda$"
	);
}

async function randomPasswordMaker(password) {
	return await bcryptPassword(password);
}

function genertatePasswordSetLink(id, token) {
	let frontAppUrl = getFrontAppSetUrl();
	return `${frontAppUrl}/${id}/${token}`;
}

function getDateRange(filter, startDate, endDate) {
	let SD, ED;

	if (filter == General.FILTER_WEEK) {
		SD = moment().startOf("week");
		ED = moment().endOf("week");
	} else if (filter == General.FILTER_MONTH) {
		SD = moment().startOf("month");
		ED = moment().endOf("month");
	} else if (filter == General.FILTER_CUSTOM) {
		SD = moment(startDate).startOf("day");
		ED = moment(endDate).startOf("day");
	}
	return { SD, ED };
}
function getOtp() {
	const code = Math.floor(1000 + Math.random() * 9000); // Generate 4-digit OTP
	const expiration = 30; // OTP expiration time in minutes
	const expirationTime = new Date(Date.now() + expiration * 60000); // Current time + expiration time
	return { code: code, expiration: expirationTime };
}
function generateOTP() {
	const characters = "0123456789!@#$%^&*()_+[]{}|;:,.<>?";
	let otp = "";
	for (let i = 0; i < 4; i++) {
		const randomIndex = Math.floor(Math.random() * characters.length);
		otp += characters[randomIndex];
	}
	return otp;
}

module.exports = {
	bcryptPassword,
	getPageSize,
	getSkipCount,
	checkPageLowerLimit,
	makePaginationObject,
	getPaginationDetails,
	getFrontAppUrl,
	getFrontAppSetUrl,
	getFrontAppResetUrl,
	getBackAppUrl,
	escapeLike,
	makeImagePath,
	isValueSet,
	isValueNotSet,
	passwordGenerator,
	comparePassword,
	makeFilePath,
	getDateRange,
	makeRegex,
	randomPasswordMaker,
	genertatePasswordSetLink,
	getOtp,
	generateOTP,
};
