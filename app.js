const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const app = express();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
app.use(express.json());
let db = null;
const dbPath = path.join(__dirname, "covid19IndiaPortal.db");

const initializeDBServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });

    app.listen(3000, () => {
      console.log("Server Started");
    });
  } catch (err) {
    console.log(err.message);
    process.exit(1);
  }
};
initializeDBServer();
const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  console.log(authHeader);
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401).send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "it's_a_secrete_key", async (error, payload) => {
      if (error) {
        response.status(401).send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

const convertToCamelCaseStatesList = (state_object) => {
  return {
    stateId: state_object.state_id,
    stateName: state_object.state_name,
    population: state_object.population,
  };
};

app.get("/states", authenticateToken, async (request, response) => {
  const states = `select * from state;`;
  const detailsList = await db.all(states);
  response.send(detailsList.map((obj) => convertToCamelCaseStatesList(obj)));
});

app.get("/states/:stateId", authenticateToken, async (request, response) => {
  const { stateId } = request.params;
  const stateDetail = `select * from state where state_id = ${stateId};`;
  const detail = await db.get(stateDetail);
  response.send({
    stateId: detail.state_id,
    stateName: detail.state_name,
    population: detail.population,
  });
});

app.post("/districts/", authenticateToken, async (req, res) => {
  const district = req.body;
  const addDistrictDetails = `insert into district (district_name,state_id,cases,
        cured,active,deaths)values(
            '${district.districtName}','${district.stateId}','${district.cases}',
            '${district.cured}','${district.active}','${district.deaths}'
        );`;
  await db.run(addDistrictDetails);
  res.send("District Successfully Added");
});

app.get(
  "/districts/:districtId",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const districtDetails = `select * from district where district_id = ${districtId};`;
    const detail = await db.get(districtDetails);
    response.send({
      districtId: detail.district_id,
      districtName: detail.district_name,
      stateId: detail.state_id,
      cases: detail.cases,
      cured: detail.cured,
      active: detail.active,
      deaths: detail.deaths,
    });
  }
);

app.get("/districts/", authenticateToken, async (request, response) => {
  const district = `select * from district;`;
  const detailsList = await db.all(district);
  response.send(detailsList);
});

app.delete(
  "/districts/:districtId",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const districtDetails = `delete  from district where district_id = ${districtId};`;
    const detail = await db.run(districtDetails);
    response.send("District Removed");
  }
);

app.put("/districts/:districtId", authenticateToken, async (req, res) => {
  const district = req.body;
  const { districtId } = req.params;
  const updateDistrictDetails = `update district
    set
    district_name = '${district.districtName}',
    state_id = '${district.stateId}',
    cases = '${district.cases}',
    cured = '${district.cured}',
    active = '${district.active}',
    deaths = '${district.deaths}'
    where 
    district_id= '${districtId}'`;
  await db.run(updateDistrictDetails);
  res.send("District Details Updated");
});

app.get(
  `/states/:stateId/stats/`,
  authenticateToken,
  async (request, response) => {
    const { stateId } = request.params;
    const executeQuery = `select sum(cases)as totalCases,
    sum(cured) as totalCured,
    sum(active)as totalActive,
    sum(deaths)as totalDeaths 
    from district
    where state_id = ${stateId};`;

    const result = await db.get(executeQuery);
    response.send(result);
  }
);

app.get(
  "/districts/:districtId/details",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const districtDetails = `select state_name from state where state_id = (select state_id from district where district_id = ${districtId});`;
    const detail = await db.get(districtDetails);
    response.send({
      stateName: detail.state_name,
    });
    console.log(detail);
  }
);

app.post("/login", async (request, response) => {
  const { username, password } = request.body;
  //console.log(username, password);
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}';`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400).send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "it's_a_secrete_key");
      response.send({ jwtToken });
    } else {
      response.status(400).send("Invalid password");
    }
  }
});

module.exports = app;
