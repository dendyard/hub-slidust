import dustFlowIcon from '../../assets/fl.png';

const DustFlowIcon = ({ size = 18 }) => (
  <img
    src={dustFlowIcon}
    alt=""
    width={size}
    height={size}
    style={{
      display: 'block',
      objectFit: 'contain',
      flexShrink: 0,
    }}
  />
);

export default DustFlowIcon;
