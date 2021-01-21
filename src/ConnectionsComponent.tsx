import { ValidatedConnection } from "./useStatus";
import { useStyles } from "./useStyles";
import {
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Paper,
  Typography,
} from "@material-ui/core";
import FaceIcon from "@material-ui/core/SvgIcon/SvgIcon";
import React from "react";
import VerifiedUserIcon from "@material-ui/icons/VerifiedUser";

export const ConnectionsComponent: React.SFC<{
  connections: ValidatedConnection[];
}> = (props) => {
  const classes = useStyles();

  return (
    <Paper className={classes.paper}>
      <Typography variant="h6" className={classes.title}>
        Peers
      </Typography>
      <div>
        <List>
          {props.connections.map((u) => (
            <ListItem alignItems="flex-start" key={u.remoteID}>
              <ListItemIcon>
                <FaceIcon />
              </ListItemIcon>
              <ListItemText
                primary={u.remoteID}
                secondary={
                  <>
                    <VerifiedUserIcon fontSize="small" />
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
