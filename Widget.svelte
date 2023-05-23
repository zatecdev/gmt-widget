<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0-alpha3/dist/css/bootstrap.min.css" rel="stylesheet" integrity="sha384-KK94CHFLLe+nY2dmCWGMq91rCGa5gtU4mk92HdvYe+M/SXH301p5ILy+dN9+nJOZ" crossorigin="anonymous">
<link rel='stylesheet' href='https://fonts.googleapis.com/css?family=Open+Sans:400,700&amp'>
<link rel='stylesheet' href='https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.4.0/css/font-awesome.min.css'>

<script>
    import Counter from "./Counter.svelte";
    export let customerId;

    const customers = [
        {
            id: 111111,
            name: 'ImpactHero',
            trees: {
                icon: 'fa fa-tree',
                count: 10000,
                caption: 'Trees planted',
            },
            hours: {
                icon: 'fa fa-clock-o',
                count: 25567,
                caption: 'Hours of work provided',
            },
            individuals: {
                icon: '	fa fa-user',
                count: 1800,
                caption: 'Individuals engaged',
            },
            education: {
                icon: 'fa fa-briefcase',
                count: 16899,
                caption: 'Days of education provided'
            }
        },
        {
            id: 222222,
            name: 'MarcelSomething',
            trees: {
                icon: 'fa fa-tree',
                count: 2000,
                caption: 'Trees planted',
            },
            hours: {
                icon: 'fa fa-clock-o',
                count: 546,
                caption: 'Hours of work provided',
            },
            individuals: {
                icon: '	fa fa-user',
                count: 94,
                caption: 'Individuals engaged',
            },
            education: {
                icon: 'fa fa-briefcase',
                count: 100,
                caption: 'Days of education provided'
            }
        },
        {
            id: 333333,
            name: 'AEC Europe',
            trees: {
                icon: 'fa fa-tree',
                count: 11000,
                caption: 'Trees planted',
            },
            hours: {
                icon: 'fa fa-clock-o',
                count: 15998,
                caption: 'Hours of work provided',
            },
            individuals: {
                icon: '	fa fa-user',
                count: 869,
                caption: 'Individuals engaged',
            },
            education: {
                icon: 'fa fa-briefcase',
                count: 2137,
                caption: 'Days of education provided'
            }
        }
    ]

    function getCustomer ( id ) {

        let customer = customers.find(customer => customer.id == id );

        return customer; //return something if not found, default
    }

    let customer = getCustomer(customerId);

</script>


<div id="projectFacts" class="sectionClass">
    <div class="fullWidth eight columns">
        <div class="projectFactsWrap ">
            <Counter details={customer.trees} />
            <Counter details={customer.hours} />
            <Counter details={customer.individuals} />
            <Counter details={customer.education} />
        </div>
    </div>
</div>

<style>
    
.sectionClass {
  padding: 20px 0px 50px 0px;
  position: relative;
  display: block;
}

.fullWidth {
    width: 80% !important;
    display: table;
    float: none;
    padding: 0;
    min-height: 1px;
    height: 100%;
    position: relative;
    margin: 0 auto;
}


.sectiontitle {
  background-position: center;
  margin: 30px 0 0px;
  text-align: center;
  min-height: 20px;
}

.sectiontitle h2 {
  font-size: 30px;
  color: #222;
  margin-bottom: 0px;
  padding-right: 10px;
  padding-left: 10px;
}


.headerLine {
  width: 160px;
  height: 2px;
  display: inline-block;
  background: #101F2E;
}


.projectFactsWrap{
    display: flex;
  margin-top: 30px;
  flex-direction: row;
  flex-wrap: wrap;
}


#projectFacts .fullWidth{
  padding: 0;
}

.projectFactsWrap .item{
  width: 25%;
  height: 100%;
  padding: 50px 0px;
  text-align: center;
}

.projectFactsWrap .item:nth-child(1){
  background: rgb(16, 31, 46);
}

.projectFactsWrap .item:nth-child(2){
  background: rgb(18, 34, 51);
}

.projectFactsWrap .item:nth-child(3){
  background: rgb(21, 38, 56);
}

.projectFactsWrap .item:nth-child(4){
  background: rgb(23, 44, 66);
}

.projectFactsWrap .item p.number{
  font-size: 40px;
  padding: 0;
  font-weight: bold;
}

.projectFactsWrap .item p{
  color: rgba(255, 255, 255, 0.8);
  font-size: 18px;
  margin: 0;
  padding: 10px;
  font-family: 'Open Sans';
}


.projectFactsWrap .item span{
  width: 60px;
  background: rgba(255, 255, 255, 0.8);
  height: 2px;
  display: block;
  margin: 0 auto;
}


.projectFactsWrap .item i{
  vertical-align: middle;
  font-size: 50px;
  color: rgba(255, 255, 255, 0.8);
}


.projectFactsWrap .item:hover i, .projectFactsWrap .item:hover p{
  color: white;
}

.projectFactsWrap .item:hover span{
  background: white;
}

@media (max-width: 786px){
  .projectFactsWrap .item {
     flex: 0 0 50%;
  }
}
</style>