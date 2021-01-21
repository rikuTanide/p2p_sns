import { Comment } from "./useStatus";
import React from "react";
import {
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Paper,
} from "@material-ui/core";
import FaceIcon from "@material-ui/core/SvgIcon/SvgIcon";
import VerifiedUserIcon from "@material-ui/icons/VerifiedUser";

export const CommentsComponent: React.SFC<{
  comments: Comment[];
}> = (props) => {
  const c = (
    <List>
      {props.comments.map((c, i) => (
        <ListItem alignItems="flex-start" key={i}>
          <ListItemIcon>
            <FaceIcon />
          </ListItemIcon>
          <ListItemText
            primary={c.text}
            secondary={
              <>
                <VerifiedUserIcon />
                {c.publicKeyDigest.slice(0, 10)}
              </>
            }
          />
        </ListItem>
      ))}
    </List>
  );

  return <Paper>{c}</Paper>;
};
