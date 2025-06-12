// const passport = require("passport");
// const GitHubStrategy = require("passport-github").Strategy;
// const UserService = require("../user/user.service");
// const Invitation = require("../project/invitation/invitation.model");
// const Project = require("../project/project.model");

// passport.use(
//   new GitHubStrategy(
//     {
//       clientID: process.env.GITHUB_CLIENT_ID,
//       clientSecret: process.env.GITHUB_CLIENT_SECRET,
//       callbackURL: `${process.env.BACKEND_URL}/api/auth/github/callback`,
//       passReqToCallback: true, // Add this to access the request object
//     },
//     async (req, accessToken, refreshToken, profile, done) => {
//       try {
//         const email = profile._json.email || "No email";
//         const name = profile.displayName || profile.username;
//         const picture = profile._json.avatar_url;
//         const password = "";
//         const inviteToken =
//           req.query.invite ||
//           (req.query.state ? req.query.state.split("=")[1] : null);

//         let user;
//         if (email && email !== "No email") {
//           user = await UserService.findByEmail(email);

//           if (!user) {
//             user = await UserService.create(name, email, password, picture);

//             // Process invitation if token exists
//             if (inviteToken) {
//               const invitation = await Invitation.findOne({
//                 token: inviteToken,
//               });

//               if (
//                 invitation &&
//                 invitation.inviteeEmail === email.toLowerCase()
//               ) {
//                 const project = await Project.findById(invitation.project);

//                 if (!project.members.includes(user._id)) {
//                   project.members.push(user._id);
//                   await project.save();
//                 }

//                 invitation.status = "Accepted";
//                 await invitation.save();
//               }
//             }
//           } else if (inviteToken) {
//             // Handle existing user with invite
//             const invitation = await Invitation.findOne({
//               token: inviteToken,
//               inviteeEmail: email.toLowerCase(),
//             });

//             if (invitation) {
//               const project = await Project.findById(invitation.project);

//               if (!project.members.includes(user._id)) {
//                 project.members.push(user._id);
//                 await project.save();
//               }

//               invitation.status = "Accepted";
//               await invitation.save();
//             }
//           }
//         } else {
//           user = await UserService.findByUsername(profile.username);
//           if (!user) {
//             user = await UserService.create(name, null, password, picture);
//           }
//         }

//         return done(null, user);
//       } catch (error) {
//         return done(error, null);
//       }
//     }
//   )
// );

// // Keep existing serialize/deserialize functions

// // Serialize and deserialize user
// passport.serializeUser((user, done) => {
//   done(null, user.id);
// });

// passport.deserializeUser(async (id, done) => {
//   try {
//     const user = await UserService.findById(id);
//     done(null, user);
//   } catch (error) {
//     done(error, null);
//   }
// });
