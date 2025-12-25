// Mongoose
const mongoose = require("mongoose");

// Moment
const moment = require("moment");

// Models
const User = require("./user.model");

// Helpers
const GeneralHelper = require("../shared/GeneralHelper");
const { bcryptPassword } = require("../shared/GeneralHelper");

exports.list = async (pageNo = 1, searchValue = null, accountType = null) => {
  let pg = GeneralHelper.getPaginationDetails(pageNo);
  let matchStage = { deletedAt: null };

  if (searchValue) {
    const regex = GeneralHelper.makeRegex(searchValue);
    matchStage.$or = [{ name: regex }, { email: regex }];
  }

  let pipeline = [{ $match: matchStage }];

  // Add account-based filtering
  if (accountType) {
    if (accountType === "non-traders") {
      pipeline.push({
        $match: {
          $or: [{ accounts: { $exists: false } }, { accounts: { $eq: [] } }],
        },
      });
    } else {
      // Lookup accounts to filter by type
      pipeline.push({
        $lookup: {
          from: "accounts",
          localField: "accounts",
          foreignField: "_id",
          as: "accountDetails",
        },
      });

      if (accountType === "live") {
        pipeline.push({
          $match: {
            "accountDetails.accountType": "live",
          },
        });
      } else if (accountType === "demo") {
        pipeline.push({
          $match: {
            $and: [
              { accountDetails: { $ne: [] } },
              { "accountDetails.accountType": { $not: { $eq: "live" } } },
            ],
          },
        });
      }
    }
  }

  // Get total count
  let countPipeline = [...pipeline, { $count: "total" }];
  let countResult = await User.aggregate(countPipeline);
  let total = countResult.length > 0 ? countResult[0].total : 0;

  // Add pagination
  pipeline.push(
    { $sort: { _id: -1 } },
    { $skip: pg.skip },
    { $limit: pg.pageSize }
  );

  // Populate accounts
  pipeline.push({
    $lookup: {
      from: "accounts",
      localField: "accounts",
      foreignField: "_id",
      as: "accounts",
    },
  });

  let result = await User.aggregate(pipeline);

  return {
    pagination: GeneralHelper.makePaginationObject(
      pg.pageNo,
      pg.pageSize,
      pg.skip,
      total,
      result.length
    ),
    data: result,
  };
};

exports.findByEmail = async (email) => {
  return await User.findOne({
    email: email,
    deletedAt: null,
  });
};
exports.findByUsername = async (value) => {
  return await User.findOne({
    username: value.trim().toLowerCase(),
    deletedAt: null,
  });
};
exports.findById = async (_id) => {
  return await User.findOne({ _id: _id, deletedAt: null });
};

exports.findAll = async () => {
  return await User.find({ deletedAt: null });
};

exports.findByRole = async (role) => {
  return await User.findOne({ role: role });
};

exports.findUserIdByRole = async (role) => {
  return await User.find({ role: role }).distinct("_id");
};

exports.update = async (findObj, setObj) => {
  return await User.updateOne(findObj, { $set: setObj });
};

exports.getUserName = async (user) => {
  return `${user.details.firstName} ${user.details.lastName}`;
};

exports.create = async (name, email, password, picture) => {
  let hashPassword;
  if (password) {
    hashPassword = await bcryptPassword(password);
  } else {
    hashPassword = ""; //(Google OAuth case)
  }
  const user = new User({
    _id: new mongoose.Types.ObjectId(),
    name: name,
    email: email.trim().toLowerCase(),
    password: hashPassword,
    profilePicture: picture || "",
  });
  return await user.save();
};

exports.delete = async (id) => {
  await User.updateOne({ _id: id }, { $set: { deletedAt: moment() } }).exec();
};

exports.generateReport = async (startDate, endDate) => {
  try {
    // Ensure dates are valid and properly formatted
    let start = new Date(startDate);
    let end = new Date(endDate);
    end.setHours(23, 59, 59, 999); // Set end time to the end of the day

    // Query to get the total number of users registered in the date range
    const totalUsers = await User.countDocuments({
      createdAt: { $gte: start, $lte: end },
    });

    // Query to get the number of users registered each day in the date range
    const dailyRegistrations = await User.aggregate([
      {
        $match: {
          createdAt: { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ]);

    // Format the daily registrations result
    let dailyData = dailyRegistrations.map((record) => ({
      date: record._id,
      count: record.count,
    }));

    return {
      totalUsers,
      dailyData,
    };
  } catch (error) {
    console.error("Error generating user report:", error);
    throw new Error("Internal server error");
  }
};
