import { useUserList } from "@adapters/query/userQuery";
import { Link } from "react-router";

export default function UserList() {
  const { data: users } = useUserList();

  return (
    <div>
      <h1>User List</h1>
      <ul>
        {users &&
          users.map((user) => (
            <li key={user.id}>
              <Link to={`/app/user/${user.id}`}>{user.name}</Link>
            </li>
          ))}
      </ul>
    </div>
  );
}
