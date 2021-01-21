import { User } from "./useStatus";
import React, { ChangeEvent, useState } from "react";
import {
  Container,
  Paper,
  Typography,
  Button,
  TextField,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
} from "@material-ui/core";
import { useStyles } from "./useStyles";
import VerifiedUserIcon from "@material-ui/icons/VerifiedUser";
import FaceIcon from "@material-ui/icons/Face";
export const UsersComponent: React.SFC<{ users: User[] }> = (props) => {
  const classes = useStyles();

  return (
    <Paper className={classes.paper}>
      <Typography variant="h6" className={classes.title}>
        Users
      </Typography>
      <div>
        <List>
          {props.users.map((u) => (
            <ListItem alignItems="flex-start" key={u.publicKeyDigest}>
              <ListItemIcon>
                <FaceIcon />
              </ListItemIcon>
              <ListItemText
                primary={u.name}
                secondary={
                  <>
                    {u.introduce}
                    <br />
                    <VerifiedUserIcon />
                    {u.publicKeyDigest.slice(0, 10)}
                  </>
                }
              />
            </ListItem>
          ))}
        </List>
      </div>
    </Paper>
  );
};

export const EditUserComponent: React.SFC<{ me: User }> = (props) => {
  const [name, setName] = useState(props.me.name);
  const [introduce, setIntroduce] = useState(props.me.introduce);
  const classes = useStyles();

  function onNameInput(e: ChangeEvent<HTMLInputElement>) {
    setName(e.target.value);
  }

  function onIntroduceInput(e: ChangeEvent<HTMLInputElement>) {
    setIntroduce(e.target.value);
  }

  const changed = !(name == props.me.name && introduce == props.me.introduce);

  return (
    <Paper className={classes.paper}>
      <TextField
        label="名前"
        variant="outlined"
        value={name}
        onChange={onNameInput}
      />
      <TextField
        label="自己紹介"
        multiline
        rows={4}
        value={introduce}
        onChange={onIntroduceInput}
        variant="outlined"
      />
      <p>
        <VerifiedUserIcon />
        {props.me.publicKeyDigest.slice(0, 10)}
      </p>
      <Button size="small" color="primary" disabled={!changed}>
        保存
      </Button>
    </Paper>
  );
};
