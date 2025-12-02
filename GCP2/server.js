const { api } = require("./index");

const port = process.env.PORT || 8080;

api.listen(port, () => {
  console.log(`Inquiry API server listening on port ${port}`);
});
