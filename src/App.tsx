import React, { ChangeEvent } from "react";
import logo from "./logo.svg";
import "./App.css";
import { useSns } from "./useStatus";
import { ConnectionBundler } from "./ConnectionBundler";
import { P2pController } from "./P2pController";
import { AuthService } from "./AuthService";
import { HistoryService } from "./HistoryService";
import SendIcon from "@material-ui/icons/Send";
import {
  AppBar,
  Box,
  Button,
  IconButton,
  Toolbar,
  Typography,
  Menu,
  Link,
  Grid,
  TextField,
  Container,
  Paper,
} from "@material-ui/core";
import MenuIcon from "@material-ui/icons/Menu";
import { useStyles } from "./useStyles";
import { EditUserComponent, UsersComponent } from "./UsersComponent";
import { ConnectionsComponent } from "./ConnectionsComponent";
import { CommentsComponent } from "./CommentsComponent";

export const App: React.FunctionComponent<{
  cb: ConnectionBundler;
  p2pController: P2pController;
  auth: AuthService;
  history: HistoryService;
}> = (props) => {
  const [state, handler, texts] = useSns(
    props.cb,
    props.p2pController,
    props.auth,
    props.history
  );

  const roomID = state.roomID;
  const text = texts.find((t) => t.roomID == roomID)?.text || "";

  function onTextChange(e: ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    handler.onTextInput(roomID, value);
  }

  function onSubmit() {
    handler.onSubmit(roomID);
  }

  function setUserProfile(name: string, introduce: string) {
    props.p2pController.setUserProfile(name, introduce, props.cb);
  }

  const comments = state.comments.filter((c) => c.roomID == roomID);

  const classes = useStyles();

  const me = state.users.find((u) => u.own);

  return (
    <Box className={classes.background}>
      <AppBar position="static">
        <Toolbar>
          <IconButton
            edge="start"
            color="inherit"
            aria-label="menu"
            className={classes.menuButton}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h1" className={classes.title}>
            enc.live
          </Typography>
          <Link color="inherit" href="/">
            新規ルーム
          </Link>
        </Toolbar>
      </AppBar>
      <Grid container>
        <Grid item xs={8}>
          <Container>
            <Paper className={classes.paper}>
              <form className={classes.root} noValidate autoComplete="off">
                <Grid container>
                  <Grid item xs={10}>
                    <TextField
                      id="outlined-multiline-static"
                      label="書き込み"
                      multiline
                      rows={4}
                      variant="outlined"
                      value={text}
                      onChange={onTextChange}
                      fullWidth
                    />
                  </Grid>
                  <Grid item xs={2}>
                    <Button
                      variant="contained"
                      color="primary"
                      onClick={onSubmit}
                    >
                      <SendIcon />
                    </Button>
                  </Grid>
                </Grid>
              </form>
            </Paper>
            <CommentsComponent comments={comments} />
          </Container>
        </Grid>
        <Grid item xs={4}>
          {me ? (
            <EditUserComponent setUserProfile={setUserProfile} me={me} />
          ) : (
            ""
          )}

          <UsersComponent users={state.users} />

          <ConnectionsComponent
            connections={state.connectionAuthStatus.validatedConnections}
          />
        </Grid>
      </Grid>
    </Box>
  );
};

export default App;
