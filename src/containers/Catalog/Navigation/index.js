import React from 'react';
import PropTypes from 'prop-types';

import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import throttle from 'react-throttle-render';
import { Button, Tree as TreeRoot, Spin } from 'antd';

import {
  PREFIX,
  ID,
  CATALOG_LOADING_STAGE,
  CATALOG_LOADING_STAGE_GROUPS,
  CATALOG_LOADING_STAGE_RESOURCES,
  CATALOG_LOADING_STAGE_NAMESPACES,
  UI_THROTTLE,
  catalogGet,
  namespaceItemsGet,
  itemsGet,
  tabOpen,
} from 'modules/k8s';

import {
  TYPE_NAMESPACE,
  TYPE_RESOURCE,
  TYPE_ITEM,
  selectAll,
} from './selectors';
import css from './index.css';

const TreeNode = TreeRoot.TreeNode;


@connect(
  state => selectAll(state[PREFIX]),
  dispatch => bindActionCreators({
    catalogGet,
    namespaceItemsGet,
    itemsGet,
    tabOpen,
  }, dispatch),
)

@throttle(UI_THROTTLE * 4)
export default class Navigation extends React.Component {

  static propTypes = {
    flags: PropTypes.object.isRequired,
    resources: PropTypes.object.isRequired,
    items: PropTypes.object.isRequired,
    namespaces: PropTypes.array.isRequired,
    catalog: PropTypes.array.isRequired,
    catalogGet: PropTypes.func.isRequired,
    namespaceItemsGet: PropTypes.func.isRequired,
    itemsGet: PropTypes.func.isRequired,
    tabOpen: PropTypes.func.isRequired,
  };

  static loadingStageLabels = {
    [CATALOG_LOADING_STAGE_GROUPS]: 'groups',
    [CATALOG_LOADING_STAGE_RESOURCES]: 'resources',
    [CATALOG_LOADING_STAGE_NAMESPACES]: 'namespaces',
  };

  state = {

    expandedKeys: [],
  };

  shouldComponentUpdate(props) {
    const { [CATALOG_LOADING_STAGE]: loadingStageCurrent } = props.flags;
    const { [CATALOG_LOADING_STAGE]: loadingStagePrevious } = this.props.flags;
    return loadingStageCurrent ? loadingStageCurrent !== loadingStagePrevious : true;
  }

  componentDidMount() {
    const { namespaces, catalog, catalogGet } = this.props;
    if (!catalog.length || catalog.length !== namespaces.length) catalogGet();
  }

  onSelect = (selectedKeys, event) => {
    const {
      props: {
        tabOpen,
      },
      onLoadData,
    } = this;

    const {
      node,
      node: {
        props: {
          custom: {
            type,
            payload,
          } = {},
        },
      },
    } = event;

    // namespace || resource -> reload
    if (type === TYPE_NAMESPACE || type === TYPE_RESOURCE) onLoadData(node);

    // item -> edit
    if (type === TYPE_ITEM) tabOpen(payload.item[ID]);

    // not item -> update keys
    else if (selectedKeys.length) this.setState({ expandedKeys: selectedKeys });
  };

  onExpand = (expandedKeys, { expanded, node }) => {
    const { eventKey: closedKey } = node.props;
    if (!expanded && !closedKey.includes(':')) { // hard coded crunch for the current key naming
      expandedKeys = expandedKeys.filter(key => !key.startsWith(closedKey));
    }
    this.setState({ expandedKeys });
  };

  onLoadData = treeNode => {
    const { namespaceItemsGet, itemsGet } = this.props;
    const { custom: { type, payload } = {}} = treeNode.props;

    // namespace
    if (type === TYPE_NAMESPACE) {
      const { namespace: { namespaced, name }} = payload;
      return new Promise(
        (resolve, reject) => namespaceItemsGet(namespaced && name, resolve, reject)
      );
    }

    // resource
    else if (type === TYPE_RESOURCE) {
      const { resource, namespace: { namespaced, name }} = payload;
      return new Promise(
        (resolve, reject) => itemsGet(resource, namespaced && name, resolve, reject)
      );
    }

    //
    else return Promise.resolve();
  };

  renderNode = node => {
    const {
      renderNode,
    } = this;

    const {
      type,
      id,
      name,
      children,
      payload,
    } = node;

    return (
      <TreeNode 
        key={id}
        title={name}
        isLeaf={!children}
        custom={{ type, payload }}>
        {
          children &&
          children.length &&
          children.map(node => renderNode(node))
        }
      </TreeNode>
    );
  };

  reloadCatalog = () => {
    const { catalogGet } = this.props;
    catalogGet({ forceNamespaces: true });
  };

  render() {

    const {
      props: {
        flags: {
          [CATALOG_LOADING_STAGE]: loadingStage,
        },
        catalog,
      },
      state: {
        expandedKeys,
      },
      onSelect,
      onExpand,
      onLoadData,
      renderNode,
      reloadCatalog,
    } = this;

    return (
      <div className={css.navigation}>
        {
          loadingStage &&
          <div className={css.spinner}>
            <Spin tip={Navigation.loadingStageLabels[loadingStage]} />
          </div>
        }
        {
          !loadingStage &&
          <div className={css.controls}>
            <Button
              shape="circle"
              icon="reload"
              size="small"
              title="Reload"
              onClick={reloadCatalog}
            />
          </div>
        }
        {
          !loadingStage &&
          <TreeRoot
            onSelect={onSelect}
            onExpand={onExpand}
            loadData={onLoadData}
            expandedKeys={expandedKeys}
            showLine>
            {
              catalog.map(node => renderNode(node))
            }
          </TreeRoot>
        }
      </div>
    );
  }
}
