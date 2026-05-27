import { resolveUploadUrl } from '../../context/DataContext';

const getInitials = (name = '') =>
  name.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();

export const getAvatarColor = (name = '') => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return `hsl(${Math.abs(hash) % 360}, 55%, 42%)`;
};

export const hasRealAvatar = (url) => Boolean(url && !url.includes('pravatar.cc'));

const UserAvatar = ({ user, size = 36, style = {}, className = '', ...rest }) => {
  const base = {
    width: size,
    height: size,
    borderRadius: '50%',
    flexShrink: 0,
    ...style,
  };

  if (hasRealAvatar(user?.avatar)) {
    return (
      <img
        src={resolveUploadUrl(user.avatar)}
        alt={user?.name || ''}
        style={{ ...base, objectFit: 'cover' }}
        className={className}
        {...rest}
      />
    );
  }

  return (
    <div
      style={{
        ...base,
        background: getAvatarColor(user?.name || ''),
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 700,
        fontSize: size * 0.38,
        userSelect: 'none',
      }}
      className={className}
      {...rest}
    >
      {getInitials(user?.name)}
    </div>
  );
};

export default UserAvatar;
